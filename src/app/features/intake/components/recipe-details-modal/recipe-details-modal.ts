import { Component, input, model, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';
import { DishItem } from '../../models/intake.models';
import { formatQuantity, toFraction, applyOptimizationToDish } from '../../../../core/helpers/nutrition-optimizer';

@Component({
  selector: 'app-recipe-details-modal',
  standalone: true,
  imports: [CommonModule, PrimeNGModule],
  templateUrl: './recipe-details-modal.html',
  styleUrl: './recipe-details-modal.css',
})
export class RecipeDetailsModal {
  isOpen = model<boolean>(false);
  dish = input<DishItem | null>(null);
  onOpenShoppingList = output<DishItem>();

  mealTitles: Record<string, string> = {
    BREAKFAST: 'DESAYUNO',
    SNACK_AM: 'SNACK MAÑANA',
    LUNCH: 'ALMUERZO',
    SNACK_PM: 'SNACK TARDE',
    DINNER: 'CENA',
    SNACK_EXTRA: 'SNACK EXTRA',
    DRINK: 'BEBIDAS',
  };

  activeDish = computed<DishItem | null>(() => {
    const d = this.dish();
    if (!d) return null;
    return d.isOptimizerActive && d.optimizerTargets ? applyOptimizationToDish(d) : d;
  });

  formatQuantity(quantity: number, unit?: string, mode?: string): string {
    return formatQuantity(quantity, unit, mode);
  }

  toFraction(val: number): string {
    return toFraction(val);
  }

  openShoppingList() {
    const d = this.activeDish() || this.dish();
    if (d) {
      this.isOpen.set(false);
      this.onOpenShoppingList.emit(d);
    }
  }

  close() {
    this.isOpen.set(false);
  }
}
