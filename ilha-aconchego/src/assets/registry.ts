import type * as THREE from 'three';

/** Builds a fresh object every time it is called. */
export type AssetFactory = () => THREE.Object3D;

/**
 * Every visible object in the world is created through this registry by name
 * ("tree.peach", "fence.log"...). Today the names point to procedural placeholders;
 * later a glTF model made in Blender can replace any of them with `useGltf`,
 * and nothing else in the code has to change.
 */
export class AssetRegistry {
  private readonly factories = new Map<string, AssetFactory>();
  private readonly models = new Map<string, THREE.Object3D>();

  register(name: string, factory: AssetFactory): void {
    if (this.factories.has(name)) throw new Error(`Asset "${name}" is already registered`);
    this.factories.set(name, factory);
  }

  has(name: string): boolean {
    return this.models.has(name) || this.factories.has(name);
  }

  names(): string[] {
    return [...new Set([...this.factories.keys(), ...this.models.keys()])].sort();
  }

  /** Returns a new instance of the asset: the glTF model if one was loaded, otherwise the placeholder. */
  create(name: string): THREE.Object3D {
    const model = this.models.get(name);
    if (model) return model.clone(true);
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`Unknown asset "${name}"`);
    const object = factory();
    object.name = name;
    return object;
  }

  /** Replaces a placeholder with a glTF/GLB model. The loader is only downloaded when first used. */
  async useGltf(name: string, url: string): Promise<void> {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.name = name;
    gltf.scene.traverse(o => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    this.models.set(name, gltf.scene);
  }
}

export const assets = new AssetRegistry();
