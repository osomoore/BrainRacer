/** Catalog registry (orchestrator-owned). */
import type { WorkshopCatalog, WorkshopId } from '../core/types';
import { RACE_CATALOG } from './race/catalog';
import { DINO_CATALOG } from './dino/catalog';

export const CATALOGS: Readonly<Record<WorkshopId, WorkshopCatalog>> = { race: RACE_CATALOG, dino: DINO_CATALOG };
