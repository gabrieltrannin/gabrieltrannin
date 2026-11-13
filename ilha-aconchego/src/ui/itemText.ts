import type { ItemStack } from '../core/types';
import { t, type MessageKey } from '../i18n';

/** Name of a stack, with its quality ("Morango (ouro)"). */
export function itemName(stack: Pick<ItemStack, 'item' | 'q'>): string {
  const name = t(`item.${stack.item}`);
  return stack.q ? `${name} (${t(`quality.${stack.q}` as MessageKey)})` : name;
}
