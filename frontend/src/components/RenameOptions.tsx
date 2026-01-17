import { Checkbox } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { Typography } from "./Typography";

export type RenameStrategy = "date_original" | "datetime_original" | "label_date";
export type RenameLabelPosition = "prefix" | "suffix";
export type RenameDatePosition = "prefix" | "suffix" | "none";

export interface RenameOptionsProps {
  enabled: boolean;
  strategy: RenameStrategy;
  label: string;
  labelPosition: RenameLabelPosition;
  datePosition: RenameDatePosition;
  onToggleEnabled: (next: boolean) => void;
  onChangeStrategy: (next: RenameStrategy) => void;
  onChangeLabel: (next: string) => void;
  onChangeLabelPosition: (next: RenameLabelPosition) => void;
  onChangeDatePosition: (next: RenameDatePosition) => void;
}

const STRATEGY_LABELS: Record<RenameStrategy, string> = {
  date_original: "YYYY-MM-DD_Original",
  datetime_original: "YYYY-MM-DD_HHMMSS_Original",
  label_date: "Label + Date",
};

const SAMPLE_ORIGINAL = "IMG_4521.jpg";
const SAMPLE_DATE = {
  date_original: "2026-01-17",
  datetime_original: "2026-01-17_142530",
  label_date: "2026-01-17",
};

const LABEL_POSITION_LABELS: Record<RenameLabelPosition, string> = {
  prefix: "Prefix",
  suffix: "Suffix",
};

const DATE_POSITION_LABELS: Record<RenameDatePosition, string> = {
  prefix: "Date First",
  suffix: "Date Last",
  none: "No Date",
};

export default function RenameOptions({
  enabled,
  strategy,
  label,
  labelPosition,
  datePosition,
  onToggleEnabled,
  onChangeStrategy,
  onChangeLabel,
  onChangeLabelPosition,
  onChangeDatePosition,
}: RenameOptionsProps) {
  const isLabelDateOnly = strategy === "label_date";
  const labelPositionValue = isLabelDateOnly ? "prefix" : labelPosition;
  const datePositionValue = isLabelDateOnly ? "suffix" : datePosition;

  const buildPreview = () => {
    const labelPart = label.trim() ? label.trim() : null;
    if (isLabelDateOnly) {
      const parts = [labelPart, SAMPLE_DATE[strategy]].filter(Boolean).join("_");
      return `${parts}.jpg`;
    }

    const datePart = datePosition === "none" ? null : SAMPLE_DATE[strategy];
    const prefixParts: string[] = [];
    const suffixParts: string[] = [];

    if (datePart && datePosition === "prefix") prefixParts.push(datePart);
    if (labelPart && labelPosition === "prefix") prefixParts.push(labelPart);
    if (labelPart && labelPosition === "suffix") suffixParts.push(labelPart);
    if (datePart && datePosition === "suffix") suffixParts.push(datePart);

    const core = [
      ...prefixParts,
      SAMPLE_ORIGINAL.replace(/\.[^/.]+$/, ""),
      ...suffixParts,
    ]
      .filter(Boolean)
      .join("_");

    return `${core}.jpg`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Typography as="p" variant="caption" className="text-slate-400 tracking-wider font-bold">
            Rename Files (Optional)
          </Typography>
          <Typography as="p" variant="body-sm" className="text-[10px] text-slate-500">
            Rename using metadata date when available. Otherwise, keep original.
          </Typography>
        </div>
        <Checkbox
          isSelected={enabled}
          onValueChange={onToggleEnabled}
          color="success"
          classNames={{
            label: "text-xs text-slate-200",
            wrapper: "before:border-slate-500",
          }}
        >
          <Typography as="span" variant="label" className="text-xs text-slate-200">
            Enable
          </Typography>
        </Checkbox>
      </div>

      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-slate-600/30 bg-slate-800/40 p-4 transition-opacity ${
          enabled ? "opacity-100" : "opacity-50 pointer-events-none"
        }`}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <Typography as="p" variant="caption" className="text-slate-500 tracking-widest">
              Date Format
            </Typography>
            <div className="relative">
              <select
                value={strategy}
                onChange={(e) => onChangeStrategy(e.target.value as RenameStrategy)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {Object.entries(STRATEGY_LABELS).map(([value, labelText]) => (
                  <option key={value} value={value} className="bg-slate-900">
                    {labelText}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Typography as="p" variant="caption" className="text-slate-500 tracking-widest">
              Custom Label
            </Typography>
            <input
              type="text"
              value={label}
              onChange={(e) => onChangeLabel(e.target.value)}
              placeholder="e.g. my-name"
              className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Typography as="p" variant="caption" className="text-slate-500 tracking-widest">
                Label Position
              </Typography>
              <select
                value={labelPositionValue}
                onChange={(e) => onChangeLabelPosition(e.target.value as RenameLabelPosition)}
                disabled={isLabelDateOnly}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {Object.entries(LABEL_POSITION_LABELS).map(([value, labelText]) => (
                  <option key={value} value={value} className="bg-slate-900">
                    {labelText}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Typography as="p" variant="caption" className="text-slate-500 tracking-widest">
                Date Position
              </Typography>
              <select
                value={datePositionValue}
                onChange={(e) => onChangeDatePosition(e.target.value as RenameDatePosition)}
                disabled={isLabelDateOnly}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {Object.entries(DATE_POSITION_LABELS).map(([value, labelText]) => (
                  <option key={value} value={value} className="bg-slate-900">
                    {labelText}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-600/40 bg-slate-900/40 px-3 py-3">
          <div className="p-2 rounded-lg bg-slate-700/50 text-slate-300">
            <RotateCcw size={16} />
          </div>
          <div>
            <Typography as="p" variant="caption" className="text-slate-500 tracking-widest">
              Preview
            </Typography>
            <Typography as="p" variant="mono" className="text-xs text-slate-200">
              {buildPreview()}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  );
}
