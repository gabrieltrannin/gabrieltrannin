import type { AssetRegistry } from '../registry';
import { registerFarm } from './farm';
import { registerNature } from './nature';
import { registerVillage } from './village';

export { repaintStallSigns } from './village';

/**
 * Registers every procedural placeholder under the name its future glTF model will use.
 * Registering does not build anything: objects are made on first `create` (they need a browser).
 *
 * Conventions a glTF model must keep to plug in:
 * - meshes named "only:winter", "only:autumn" or "only:warm" are shown only in that season;
 * - "fruit" meshes hide in winter; "lamp"/"window" meshes use the night-glow materials;
 * - "sign_face" is the painted face of a sign; the windmill has a child named "blades".
 */
export function registerProceduralAssets(registry: AssetRegistry): void {
  registerNature(registry);
  registerFarm(registry);
  registerVillage(registry);
}

/** Every object the design document lists under "Elementos que precisam existir", by asset name. */
export const REQUIRED_ELEMENTS: Record<string, readonly string[]> = {
  'canteiros com moldura de madeira': ['bed.frame'],
  'cercados por toras': ['fence.log'],
  'placa com o desenho de cada cultivo': ['sign.crop'],
  'varal de luzinhas': ['light.pole', 'light.bulb'],
  'barracas de toldo listrado com franja recortada': ['stall.bread', 'stall.honey', 'stall.flowers'],
  'postes com globo de luz': ['lamp.globe'],
  'cercas vivas': ['hedge.block'],
  'mesinhas de café com cadeiras': ['table.cafe'],
  'grama alta': ['grass.tuft'],
  'pinheiros em camadas com raiz aparente': ['tree.pine'],
  'árvores frutíferas redondas': ['tree.apple', 'tree.pear', 'tree.peach', 'tree.orange', 'tree.cherry'],
  coqueiros: ['tree.palm'],
  moinho: ['windmill'],
  silo: ['silo'],
  colmeias: ['beehive'],
  espantalho: ['scarecrow'],
  'carrinho de mão': ['wheelbarrow'],
  'bomba de água': ['pump.water'],
  'caixa de correio': ['mailbox'],
  barris: ['barrel'],
  'cabana redonda com telhado de palha': ['house.hut'],
};
