/**
 * Rectángulo del mundo que ve la cámara, calculado desde su scroll y zoom.
 * (camera.worldView solo se actualiza al renderizar; esto sirve también antes del primer frame)
 */
export function getViewRect(camera, out = { x: 0, y: 0, width: 0, height: 0 }) {
  const w = camera.width / camera.zoom;
  const h = camera.height / camera.zoom;
  out.x = camera.scrollX + (camera.width - w) / 2;
  out.y = camera.scrollY + (camera.height - h) / 2;
  out.width = w;
  out.height = h;
  return out;
}
