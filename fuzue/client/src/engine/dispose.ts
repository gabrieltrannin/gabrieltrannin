import * as THREE from 'three';

/**
 * Libera da placa de vídeo as geometrias e texturas de uma cena que não será
 * mais usada. Os materiais ficam (são compartilhados entre telas), e as
 * geometrias marcadas com `userData.shared` também (usadas por todas as telas).
 */
export function disposeScene(scene: THREE.Scene): void {
  scene.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData.shared) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      const map = (m as THREE.MeshToonMaterial).map;
      if (map) map.dispose();
    }
  });
  scene.clear();
}
