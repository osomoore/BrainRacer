import { expect, test } from '@playwright/test';

test('Mine wagons collide with a car and detach from the hit wagon back under turbo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?race=1&map=underground&seed=3&questions=off');
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.25, undefined, { timeout: 35_000 });

  const contact = await page.evaluate(() => {
    const { scene, players } = window.__race;
    const world = scene.matter.world;
    const wagons = world.getAllBodies().filter(body => body.label === 'underground-mine-cart');
    const engines = world.getAllBodies().filter(body => body.label === 'underground-mine-engine');
    const car = players[0];
    const wagon = wagons[0];
    const sx = -Math.sin(wagon.angle), sy = Math.cos(wagon.angle);
    scene.matter.body.setPosition(car.body, { x: wagon.position.x + sx * 50, y: wagon.position.y + sy * 50 });
    scene.matter.body.setAngle(car.body, Math.atan2(-sy, -sx));
    scene.matter.body.setVelocity(car.body, { x: -sx * 3.8, y: -sy * 3.8 });

    return new Promise<{ wagons: number; engines: number; intact: boolean; matched: boolean }>(resolve => {
      // Read Matter's collision pair directly so any unrelated scenery contact can't satisfy the test.
      const finish = (collided: boolean) => {
        world.off('collisionstart', hit);
        clearTimeout(timeout);
        resolve({ wagons: wagons.length, engines: engines.length, intact: collided && wagon.collisionFilter.mask !== 0,
          matched: wagons.every(body => body.isStatic && !body.isSensor && body.plugin?.owner?.kind === 'train') });
      };
      const hit = ({ pairs }: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) => {
        if (pairs.some(({ bodyA, bodyB }) => (bodyA === wagon && bodyB === car.body) || (bodyB === wagon && bodyA === car.body))) finish(true);
      };
      const timeout = setTimeout(() => finish(false), 4000);
      world.on('collisionstart', hit);
    });
  });
  expect(contact).toEqual({ wagons: 8, engines: 4, intact: true, matched: true });

  await page.evaluate(() => {
    const { scene, players } = window.__race;
    const wagon = scene.matter.world.getAllBodies().filter(body => body.label === 'underground-mine-cart')[2];
    const car = players[0];
    const sx = -Math.sin(wagon.angle), sy = Math.cos(wagon.angle);
    car.setTurbo(true);
    scene.matter.body.setPosition(car.body, { x: wagon.position.x + sx * 50, y: wagon.position.y + sy * 50 });
    scene.matter.body.setAngle(car.body, Math.atan2(-sy, -sx));
    scene.matter.body.setVelocity(car.body, { x: -sx * 3.8, y: -sy * 3.8 });
  });
  await page.waitForFunction(() => {
    const { scene } = window.__race;
    const bodies = scene.matter.world.getAllBodies();
    const wagons = bodies.filter(body => body.label === 'underground-mine-cart');
    return !!wagons[1].collisionFilter.mask && !wagons[2].collisionFilter.mask && !wagons[3].collisionFilter.mask
      && !!wagons[4].collisionFilter.mask
      && bodies.filter(body => body.label === 'underground-mine-cart-debris' && !body.isStatic).length === 2
      && scene.children.list.filter(child => child.name === 'underground-mine-coupler')
        .filter(coupler => (coupler as Phaser.GameObjects.Image).visible).length === 6;
  }, undefined, { timeout: 15_000 });
  expect(errors).toEqual([]);
});
