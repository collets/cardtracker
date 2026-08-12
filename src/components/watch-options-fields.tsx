import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CARD_CONDITIONS,
  DEFAULT_CONDITIONS,
  DEFAULT_DISCOUNT_PERCENT,
  DEFAULT_LANGUAGES,
  DEFAULT_MIN_SAVINGS_CENTS,
  EU_EEA_COUNTRY_CODES,
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_LANGUAGE_LABELS,
} from "@/lib/constants";

export type WatchFormDefaults = {
  languages?: readonly string[];
  conditions?: readonly string[];
  requireZero?: boolean;
  sellerCountries?: readonly string[] | null;
  foil?: "any" | "foil" | "nonfoil";
  graded?: boolean;
  discountPercent?: number;
  minSavingsEuros?: number;
};

export function WatchOptionsFields({
  idPrefix,
  defaults = {},
  showCountryOverride = true,
}: {
  idPrefix: string;
  defaults?: WatchFormDefaults;
  showCountryOverride?: boolean;
}) {
  const languages = defaults.languages ?? DEFAULT_LANGUAGES;
  const conditions = defaults.conditions ?? DEFAULT_CONDITIONS;

  return (
    <>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">Languages</legend>
        <div className="flex flex-wrap gap-4">
          {SUPPORTED_LANGUAGE_CODES.map((value) => (
            <Checkbox
              key={value}
              name="languages"
              value={value}
              label={SUPPORTED_LANGUAGE_LABELS[value]}
              defaultChecked={languages.includes(value)}
              containerClassName="text-xs"
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-medium">Condition</legend>
        <div className="flex flex-wrap gap-4">
          {CARD_CONDITIONS.map((condition) => (
            <Checkbox
              key={condition}
              name="conditions"
              value={condition}
              label={condition}
              defaultChecked={conditions.includes(condition)}
              containerClassName="text-xs"
            />
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-foil`}>Foil</Label>
        <Select name="foil" defaultValue={defaults.foil ?? "any"}>
          <SelectTrigger id={`${idPrefix}-foil`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Foil or non-foil</SelectItem>
            <SelectItem value="foil">Foil only</SelectItem>
            <SelectItem value="nonfoil">Non-foil only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Marketplace options</Label>
        <div className="flex flex-wrap gap-4 pt-2">
          <Checkbox
            name="requireZero"
            value="on"
            label="CardTrader Zero only"
            defaultChecked={defaults.requireZero}
            containerClassName="text-xs"
          />
          <Checkbox
            name="graded"
            value="on"
            label="Graded"
            defaultChecked={defaults.graded}
            containerClassName="text-xs"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-discount`}>Minimum discount</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-discount`}
            name="discountPercent"
            type="number"
            min="1"
            max="90"
            defaultValue={defaults.discountPercent ?? DEFAULT_DISCOUNT_PERCENT}
          />
          <span className="pointer-events-none absolute top-2 right-3 text-sm text-slate-500">
            %
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-saving`}>Minimum saving</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-saving`}
            name="minSavingsEuros"
            type="number"
            min="0"
            step="0.5"
            defaultValue={
              defaults.minSavingsEuros ?? DEFAULT_MIN_SAVINGS_CENTS / 100
            }
          />
          <span className="pointer-events-none absolute top-2 right-3 text-sm text-slate-500">
            EUR
          </span>
        </div>
      </div>

      {showCountryOverride ? (
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">
            Seller country override
          </legend>
          <p className="mt-1 text-xs text-slate-500">
            Leave every country unchecked to inherit your account defaults.
          </p>
          <div className="app-scrollbar mt-3 grid max-h-40 grid-cols-4 gap-2 overflow-y-auto rounded-xl border bg-black/10 p-3 sm:grid-cols-6">
            {EU_EEA_COUNTRY_CODES.map((country) => (
              <Checkbox
                key={country}
                name="sellerCountries"
                value={country}
                label={country}
                defaultChecked={defaults.sellerCountries?.includes(country)}
                containerClassName="text-xs"
              />
            ))}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
