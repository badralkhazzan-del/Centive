"use client";

import { Label, Select } from "@/components/ui/input";
import { useT } from "@/i18n";
import { actions, useAppData } from "@/lib/repo";

export function KitchenSelector() {
  const { t } = useT();
  const data = useAppData();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="kitchen-select" className="sr-only sm:not-sr-only">
        {t.kitchen.selectKitchen}
      </Label>
      <Select
        id="kitchen-select"
        className="w-auto min-w-56"
        value={data.ui.activeKitchenId}
        onChange={(e) => actions.setActiveKitchen(e.target.value)}
        data-testid="kitchen-select"
      >
        {data.kitchens.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function KopdesSelector() {
  const { t } = useT();
  const data = useAppData();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="kopdes-select" className="sr-only">
        {t.kopdes.selectKopdes}
      </Label>
      <Select
        id="kopdes-select"
        className="w-full"
        value={data.ui.activeKopdesId}
        onChange={(e) => actions.setActiveKopdes(e.target.value)}
        data-testid="kopdes-select"
      >
        {data.kopdes.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
