#!/usr/bin/env python3
"""ComfyUI paint pass for Adventure Workshop art (see docs/WORKSHOP_ART_PIPELINE.md).

Normally started through `npm run art:paint` (scripts/art/paint.ts exports the shape PNGs first, then runs this).

  shape jobs : art-src/<file>.png (code-drawn shape, RGBA) -> crop to the shape, scale to ~1024 px, img2img + Canny
               ControlNet (union promax) with the house style prompt + StickersRedmond + a 4-step speed LoRA -> scale back,
               keep the shape's exact alpha (and optionally its outline) -> public/art/workshop/<file>.png
  prompt jobs: txt2img at the job's generation size -> downscale (optionally made tileable)

Stdlib HTTP + Pillow only. ComfyUI must already be running (default http://127.0.0.1:8188, $COMFY_URL to override).
"""
from __future__ import annotations

import argparse
import fnmatch
import io
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from PIL import Image, ImageChops, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "art-src"
OUT = ROOT / "public" / "art" / "workshop"
URL = os.environ.get("COMFY_URL", "http://127.0.0.1:8188").rstrip("/")

MODEL = "realcartoonXL_v6.safetensors"  # the only checkpoint we load: 16 GB RAM cannot hold two SDXL models + ControlNet
STICKERS_LORA = "StickersRedmond.safetensors"
SPEED_LORA = "sdxl_lightning_4step_lora.safetensors"
CONTROLNET = "diffusion_pytorch_model_promax.safetensors"
OUTLINE_RGB = (27, 27, 58)  # art/bake.ts OUTLINE #1b1b3a
BG = (232, 232, 232)
GEN_LONG = 1024
GEN_MIN_SHORT = 384

# Settings that worked (docs/WORKSHOP_ART_PIPELINE.md). All overridable on the command line for tuning.
DEFAULTS = dict(steps=8, cfg=1.5, sampler="euler", scheduler="sgm_uniform", speed=1.0,
                control_end=0.85, canny_low=0.25, canny_high=0.6)


class ComfyError(RuntimeError):
    pass


class ServerDown(ComfyError):
    """ComfyUI is not reachable (crashed or stopped): stop the whole run, never retry in a loop."""


def req(path: str, data: bytes | None = None, headers: dict | None = None):
    r = urllib.request.Request(URL + path, data=data, headers=headers or {})
    try:
        return urllib.request.urlopen(r, timeout=900)
    except urllib.error.HTTPError as e:
        raise ComfyError(f"ComfyUI {path}: HTTP {e.code}: {e.read().decode(errors='replace')[:1500]}") from None
    except urllib.error.URLError as e:
        raise ServerDown(f"ComfyUI not reachable at {URL} ({e.reason}). Start the server first.") from None
    except OSError as e:  # connection reset / aborted mid-request: the server died
        raise ServerDown(f"ComfyUI connection lost at {URL} ({e}). The server probably crashed (out of memory?); restart it and re-run.") from None


def get_json(path: str):
    try:
        return json.load(req(path))
    except OSError as e:
        raise ServerDown(f"ComfyUI connection lost ({e})") from None


def post_json(path: str, payload):
    raw = req(path, json.dumps(payload).encode(), {"Content-Type": "application/json"}).read()
    return json.loads(raw) if raw.strip() else {}


def upload(name: str, data: bytes) -> str:
    b = uuid.uuid4().hex
    body = b"".join([
        f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode(),
        data, b"\r\n",
        f'--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n'.encode(),
        f"--{b}--\r\n".encode(),
    ])
    out = json.load(req("/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={b}"}))
    return f"{out['subfolder']}/{out['name']}" if out.get("subfolder") else out["name"]


def run_workflow(wf: dict, out_node: str) -> bytes:
    pid = post_json("/prompt", {"prompt": wf, "client_id": uuid.uuid4().hex})["prompt_id"]
    t0 = time.time()
    while True:
        h = get_json(f"/history/{pid}")
        if pid in h:
            entry = h[pid]
            st = entry.get("status", {})
            if st.get("status_str") == "error":
                msgs = [m for m in st.get("messages", []) if m[0] == "execution_error"]
                raise ComfyError(f"workflow failed: {msgs[-1][1].get('exception_message') if msgs else st}")
            imgs = entry.get("outputs", {}).get(out_node, {}).get("images")
            if imgs:
                i = imgs[0]
                q = urllib.parse.urlencode({"filename": i["filename"], "subfolder": i.get("subfolder", ""), "type": i.get("type", "temp")})
                return req("/view?" + q).read()
        if time.time() - t0 > 900:
            raise ComfyError("timeout waiting for ComfyUI")
        time.sleep(0.4)


# ------------------------------------------------------------------ workflows

def base_nodes(model: str, o: dict, with_sticker: bool) -> tuple[dict, list, list]:
    """Checkpoint + LoRA chain. Returns (nodes, model_ref, clip_ref)."""
    n = {"1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model}}}
    m, c = ["1", 0], ["1", 1]
    if with_sticker and o["sticker"] > 0:
        n["2"] = {"class_type": "LoraLoader", "inputs": {"model": m, "clip": c, "lora_name": STICKERS_LORA, "strength_model": o["sticker"], "strength_clip": o["sticker"]}}
        m, c = ["2", 0], ["2", 1]
    n["3"] = {"class_type": "LoraLoader", "inputs": {"model": m, "clip": c, "lora_name": SPEED_LORA, "strength_model": o["speed"], "strength_clip": o["speed"]}}
    return n, ["3", 0], ["3", 1]


def shape_workflow(model: str, img_name: str, prompt: str, negative: str, seed: int, denoise: float, control: float, o: dict) -> dict:
    n, m, c = base_nodes(model, o, True)
    n.update({
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": c}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": c}},
        "6": {"class_type": "LoadImage", "inputs": {"image": img_name}},
        "7": {"class_type": "Canny", "inputs": {"image": ["6", 0], "low_threshold": o["canny_low"], "high_threshold": o["canny_high"]}},
        "8": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": CONTROLNET}},
        "9": {"class_type": "SetUnionControlNetType", "inputs": {"control_net": ["8", 0], "type": "canny/lineart/anime_lineart/mlsd"}},
        "10": {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["4", 0], "negative": ["5", 0], "control_net": ["9", 0], "image": ["7", 0], "strength": control, "start_percent": 0.0, "end_percent": o["control_end"]}},
        "11": {"class_type": "VAEEncode", "inputs": {"pixels": ["6", 0], "vae": ["1", 2]}},
        "12": {"class_type": "KSampler", "inputs": {"model": m, "seed": seed, "steps": o["steps"], "cfg": o["cfg"], "sampler_name": o["sampler"], "scheduler": o["scheduler"], "positive": ["10", 0], "negative": ["10", 1], "latent_image": ["11", 0], "denoise": denoise}},
        "13": {"class_type": "VAEDecode", "inputs": {"samples": ["12", 0], "vae": ["1", 2]}},
        "14": {"class_type": "PreviewImage", "inputs": {"images": ["13", 0]}},
    })
    return n


def prompt_workflow(model: str, prompt: str, negative: str, seed: int, w: int, h: int, o: dict) -> dict:
    n, m, c = base_nodes(model, o, False)
    n.update({
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": c}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": c}},
        "6": {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "12": {"class_type": "KSampler", "inputs": {"model": m, "seed": seed, "steps": o["steps"], "cfg": o["cfg"], "sampler_name": o["sampler"], "scheduler": o["scheduler"], "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0], "denoise": 1.0}},
        "13": {"class_type": "VAEDecode", "inputs": {"samples": ["12", 0], "vae": ["1", 2]}},
        "14": {"class_type": "PreviewImage", "inputs": {"images": ["13", 0]}},
    })
    return n


# ------------------------------------------------------------------ image helpers

def multiple8(v: float) -> int:
    return max(8, int(round(v / 8.0)) * 8)


def paint_shape(model: str, job: dict, o: dict) -> Image.Image:
    shape = Image.open(SRC / f"{job['file']}.png").convert("RGBA")
    alpha = shape.getchannel("A")
    bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox is None:
        raise ComfyError(f"{job['key']}: shape is empty")
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = int(max(bw, bh) * 0.08) + 8
    box = (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad)
    # keep the crop's aspect at most 1 : (1024/384) so SDXL never sees a sliver
    cw, ch = box[2] - box[0], box[3] - box[1]
    if ch * GEN_LONG / cw < GEN_MIN_SHORT:
        extra = int(cw * GEN_MIN_SHORT / GEN_LONG - ch)
        box = (box[0], box[1] - extra // 2, box[2], box[3] + extra - extra // 2)
    elif cw * GEN_LONG / ch < GEN_MIN_SHORT:
        extra = int(ch * GEN_MIN_SHORT / GEN_LONG - cw)
        box = (box[0] - extra // 2, box[1], box[2] + extra - extra // 2, box[3])
    crop = shape.crop(box)  # outside the texture it is transparent
    cw, ch = crop.size
    s = GEN_LONG / max(cw, ch)
    gw, gh = multiple8(cw * s), multiple8(ch * s)
    bg = Image.new("RGBA", crop.size, BG + (255,))
    bg.alpha_composite(crop)
    inp = bg.convert("RGB").resize((gw, gh), Image.LANCZOS)
    buf = io.BytesIO()
    inp.save(buf, "PNG")
    name = upload(f"wsart_{job['file']}.png", buf.getvalue())
    oo = dict(o, sticker=o["sticker"] if o.get("sticker") is not None else job.get("sticker", 0.6))
    wf = shape_workflow(model, name, job["prompt"], job["negative"], job["seed"], o.get("denoise") or job["denoise"], o.get("control") if o.get("control") is not None else job["control"], oo)
    out = Image.open(io.BytesIO(run_workflow(wf, "14"))).convert("RGB").resize(crop.size, Image.LANCZOS)
    # back into the full texture, keep the shape's exact alpha
    full = Image.new("RGB", shape.size, BG)
    full.paste(out, (box[0], box[1]))
    orig_rgb = shape.convert("RGB")
    a = shape.getchannel("A")
    if o["keep_outline"]:
        # crisp, identical outlines on every part: where the shape is outline-coloured keep the shape's own pixels
        diff = ImageChops.difference(orig_rgb, Image.new("RGB", shape.size, OUTLINE_RGB)).convert("L")
        m = diff.point(lambda v: 255 if v < 28 else 0).filter(ImageFilter.GaussianBlur(0.7))
        full = Image.composite(orig_rgb, full, m)
    # soft edge pixels take the shape's own colour (no light fringe from the grey background)
    full = Image.composite(full, orig_rgb, a.point(lambda v: 255 if v >= 250 else v))
    full.putalpha(a)
    return full


def make_tileable(img: Image.Image) -> Image.Image:
    w, h = img.size
    rolled = ImageChops.offset(img, w // 2, h // 2)
    # weight 1 in the centre, 0 at the borders (borders of `rolled` are seamless)
    def tri(n: int) -> list[int]:
        return [int(255 * min(1.0, 2 * min(i, n - 1 - i) / (n - 1) * 1.6)) for i in range(n)]
    mx, my = tri(w), tri(h)
    mask = Image.new("L", (w, h))
    mask.putdata([min(255, mx[x] * my[y] // 255) for y in range(h) for x in range(w)])
    return Image.composite(img, rolled, mask)


def paint_prompt(model: str, job: dict, o: dict) -> Image.Image:
    gw, gh = job.get("genW") or 1024, job.get("genH") or 576
    wf = prompt_workflow(model, job["prompt"], job["negative"], job["seed"], gw, gh, o)
    img = Image.open(io.BytesIO(run_workflow(wf, "14"))).convert("RGB").resize((job["w"], job["h"]), Image.LANCZOS)
    return make_tileable(img) if job.get("tileable") else img


# ------------------------------------------------------------------ main

def free_models() -> None:
    """Ask ComfyUI to drop cached models before a run (keeps RAM/VRAM low on this 16 GB / 6 GB machine)."""
    post_json("/free", {"unload_models": True, "free_memory": True})


def pick_model(wanted: str | None) -> str:
    model = wanted or MODEL
    avail = get_json("/object_info/CheckpointLoaderSimple")["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
    if model not in avail:
        sys.exit(f"checkpoint {model} not listed by ComfyUI; available: {avail}")
    return model


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="glob on the texture key (comma separated alternatives)")
    ap.add_argument("--force", action="store_true", help="repaint even if the job is unchanged")
    ap.add_argument("--aspect", help="only jobs of these aspects (comma list: color,head,paint,body ...)")
    ap.add_argument("--part", help="only these part families (comma list: head,torso,body,wheel ...; prompt jobs have part backdrop/texture)")
    ap.add_argument("--limit", type=int, help="paint at most N jobs")
    ap.add_argument("--model", help="checkpoint file name (default realcartoonXL_v6)")
    ap.add_argument("--out", help="write PNGs here instead of public/art/workshop and do not touch the manifest (tuning)")
    ap.add_argument("--prune", action="store_true", help="drop manifest entries (and files) whose job no longer exists")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--seed", type=int, help="override the seed (tuning)")
    ap.add_argument("--prompt", help="override the job prompt (tuning)")
    ap.add_argument("--sticker", type=float, help="StickersRedmond weight (default: per job)")
    ap.add_argument("--denoise", type=float)
    ap.add_argument("--control", type=float)
    ap.add_argument("--no-keep-outline", dest="keep_outline", action="store_false", help="use the painted outline instead of the shape's")
    for k, v in DEFAULTS.items():
        ap.add_argument(f"--{k.replace('_', '-')}", dest=k, type=type(v), default=v)
    a = ap.parse_args()
    o = {k: getattr(a, k) for k in DEFAULTS}
    o.update(sticker=a.sticker, denoise=a.denoise, control=a.control, keep_outline=a.keep_outline)

    data = json.loads((SRC / "jobs.json").read_text(encoding="utf8"))
    jobs, shape_hashes, src_hash = data["jobs"], data.get("shapeHashes", {}), data.get("srcHash", "")
    pats = [p.strip() for p in (a.only or "*").split(",")]
    match = lambda key: any(fnmatch.fnmatchcase(key, p) for p in pats)  # noqa: E731

    out_dir = pathlib.Path(a.out) if a.out else OUT
    out_dir.mkdir(parents=True, exist_ok=True)
    mpath = OUT / "manifest.json"
    manifest = json.loads(mpath.read_text(encoding="utf8")) if mpath.exists() else {"version": 1, "entries": {}}
    entries = manifest["entries"]

    if a.prune and not a.out:
        live = {j["key"] for j in jobs}
        for k in [k for k in entries if k not in live]:
            (OUT / entries[k]["file"]).unlink(missing_ok=True)
            del entries[k]
            print(f"pruned {k}")

    model = pick_model(a.model)
    todo = []
    for j in jobs:
        if not match(j["key"]):
            continue
        if a.aspect and j["aspect"] not in a.aspect.split(","):
            continue
        if a.part and j["part"] not in a.part.split(","):
            continue
        if j["kind"] == "shape" and j["key"] not in shape_hashes:
            continue  # not exported this run
        sh = shape_hashes.get(j["key"], "")
        e = entries.get(j["key"])
        unchanged = (e and e.get("specHash") == j["specHash"] and e.get("shapeHash", "") == sh and e.get("model") == model
                     and (OUT / e["file"]).exists())
        if a.out or a.force or not unchanged:
            todo.append(j)
    if a.limit:
        todo = todo[: a.limit]
    print(f"{len(todo)} job(s) to paint with {model} (of {len(jobs)} jobs)")
    if a.dry_run:
        for j in todo:
            print("  ", j["key"])
        return

    free_models()
    t_all = time.time()
    done = 0
    for j in todo:
        t0 = time.time()
        jj = dict(j)
        if a.prompt:
            jj["prompt"] = a.prompt
        if a.seed is not None:
            jj["seed"] = a.seed
        try:
            img = paint_shape(model, jj, o) if j["kind"] == "shape" else paint_prompt(model, jj, o)
        except ServerDown as e:
            print(f"STOPPED: {e}")
            sys.exit(2)
        except ComfyError as e:
            print(f"FAILED {j['key']}: {e}")
            continue
        file = f"{j['file']}.png"
        img.save(out_dir / file, "PNG", optimize=True)
        done += 1
        if not a.out:
            entries[j["key"]] = {"file": file, "w": j["w"], "h": j["h"], "specHash": j["specHash"], "srcHash": src_hash if j["kind"] == "shape" else "",
                                 "shapeHash": shape_hashes.get(j["key"], ""), "model": model, "seed": jj["seed"]}
            manifest["model"] = model
            mpath.write_text(json.dumps({"version": 1, "model": model, "entries": dict(sorted(entries.items()))}, indent=1) + "\n", encoding="utf8")
        print(f"[{done}/{len(todo)}] {j['key']}  {time.time() - t0:.1f}s  {(out_dir / file).stat().st_size / 1024:.0f} KB", flush=True)
    dt = time.time() - t_all
    print(f"painted {done} in {dt:.0f}s ({dt / max(1, done):.1f}s each)")


if __name__ == "__main__":
    try:
        main()
    except ComfyError as err:
        sys.exit(str(err))
