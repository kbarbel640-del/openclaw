export { DOLT_STORE_SCHEMA_VERSION, ensureDoltStoreSchema } from "./schema.js";
export { SqliteDoltStore, openSqliteDoltStore } from "./sqlite-dolt-store.js";
export type { OpenSqliteDoltStoreParams } from "./sqlite-dolt-store.js";
export type {
  DoltActiveLaneEntry,
  DoltActiveLaneUpsert,
  DoltBootstrapParams,
  DoltBootstrapReason,
  DoltBootstrapResult,
  DoltBootstrapTurn,
  DoltLineageChildInput,
  DoltLineageEdge,
  DoltLineageEdgeUpsert,
  DoltRecord,
  DoltRecordLevel,
  DoltRecordUpsert,
  DoltStore,
} from "./types.js";
export { DOLT_RECORD_LEVELS } from "./types.js";
