// Cola de revisión (2026-11-04, decisión del usuario): cada creador puede tener hasta
// MAX_CAMPANAS_EN_REVISION campañas en revisión a la vez; un lugar se libera cuando la supervisión
// acepta o rechaza una. No hay tope de campañas creadas ni activas.
// Sin imports de servidor: lo usan los route handlers y el formulario de campaña.

export const MAX_CAMPANAS_EN_REVISION = 5;
