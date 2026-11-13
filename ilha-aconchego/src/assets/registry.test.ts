import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetRegistry } from './registry';

describe('AssetRegistry', () => {
  it('creates a fresh, named object for each call', () => {
    const registry = new AssetRegistry();
    registry.register('rock.small', () => new THREE.Mesh(new THREE.BoxGeometry()));
    const a = registry.create('rock.small');
    const b = registry.create('rock.small');
    expect(a).not.toBe(b);
    expect(a.name).toBe('rock.small');
    expect(registry.has('rock.small')).toBe(true);
    expect(registry.names()).toEqual(['rock.small']);
  });

  it('refuses duplicate names and unknown assets', () => {
    const registry = new AssetRegistry();
    registry.register('tree.peach', () => new THREE.Group());
    expect(() => registry.register('tree.peach', () => new THREE.Group())).toThrow();
    expect(() => registry.create('tree.apple')).toThrow(/Unknown asset/);
  });
});
