import { Button, Checkbox, Chip, Input, Accordion, AccordionItem } from "@heroui/react";
import { Plus, FileImage, FileVideo, Music, Archive, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Typography } from "./Typography";

export type ExtensionCategory = "Photos" | "Videos" | "Audio" | "Archives" | "Documents";

export type ExtensionsByCategory = Record<ExtensionCategory, string[]>;

export interface ConfigPanelProps {
  extensionsByCategory: ExtensionsByCategory;
  selectedExtensions: ExtensionsByCategory;
  onChangeSelected: (next: ExtensionsByCategory) => void;
  ignoredDirs: string[];
  onAddIgnoreDir: (value: string) => void;
  onRemoveIgnoreDir: (value: string) => void;
}

const CATEGORY_ICONS: Record<ExtensionCategory, React.ReactNode> = {
  Photos: <FileImage size={16} />,
  Videos: <FileVideo size={16} />,
  Audio: <Music size={16} />,
  Archives: <Archive size={16} />,
  Documents: <FileText size={16} />,
};

export default function ConfigPanel({
  extensionsByCategory,
  selectedExtensions,
  onChangeSelected,
  ignoredDirs,
  onAddIgnoreDir,
  onRemoveIgnoreDir,
}: ConfigPanelProps) {
  const [ignoreInput, setIgnoreInput] = useState("");

  const categories = useMemo(
    () => Object.keys(extensionsByCategory) as Array<keyof ExtensionsByCategory>,
    [extensionsByCategory]
  );

  const toggleCategory = (category: ExtensionCategory) => {
    const current = new Set(selectedExtensions[category]);
    const all = extensionsByCategory[category] || [];
    const nextSelected = current.size === all.length ? [] : [...all];
    onChangeSelected({
      ...selectedExtensions,
      [category]: nextSelected,
    });
  };

  const toggleExtension = (category: ExtensionCategory, ext: string) => {
    const current = new Set(selectedExtensions[category]);
    if (current.has(ext)) current.delete(ext);
    else current.add(ext);
    onChangeSelected({
      ...selectedExtensions,
      [category]: Array.from(current),
    });
  };

  const handleAddIgnore = () => {
    const value = ignoreInput.trim();
    if (!value) return;
    onAddIgnoreDir(value);
    setIgnoreInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddIgnore();
    }
  };

  return (
    <div className="space-y-8">
      {/* File Types Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Typography as="p" variant="caption" className="text-slate-400 tracking-wider font-bold">
            File Types to Organize
          </Typography>
          <Typography as="p" variant="body-sm" className="text-[10px] text-slate-500">
            {Object.values(selectedExtensions).flat().length} types selected
          </Typography>
        </div>

        <Accordion
          variant="splitted"
          selectionMode="multiple"
          defaultExpandedKeys={["Photos"]}
          className="px-0 gap-3"
          itemClasses={{
            base: "bg-slate-800/50 border border-slate-600/30 rounded-xl shadow-none",
            title: "text-slate-200 font-medium text-sm",
            trigger: "px-4 py-3 data-[hover=true]:bg-slate-700/30 rounded-xl",
            indicator: "text-slate-400",
            content: "px-4 pb-4 pt-0",
          }}
        >
          {categories.map((category) => {
            const options = extensionsByCategory[category] || [];
            const selected = selectedExtensions[category] || [];
            const allSelected = selected.length === options.length;
            const someSelected = selected.length > 0 && selected.length < options.length;

            return (
              <AccordionItem
                key={category}
                aria-label={category}
                startContent={
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        allSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700/50 text-slate-400"
                      }`}
                    >
                      {CATEGORY_ICONS[category]}
                    </div>
                  </div>
                }
                title={
                  <div className="flex items-center justify-between flex-1">
                    <Typography as="span" variant="body" className="text-sm">
                      {category}
                    </Typography>
                    <div className="flex items-center gap-3">
                      <Typography
                        as="span"
                        variant="caption"
                        className={`text-[10px] uppercase tracking-widest ${
                          allSelected ? "text-emerald-400" : "text-slate-500"
                        }`}
                      >
                        {selected.length}/{options.length}
                      </Typography>
                      <Checkbox
                        isSelected={allSelected}
                        isIndeterminate={someSelected}
                        onValueChange={() => toggleCategory(category)}
                        color="success"
                        size="sm"
                        classNames={{
                          wrapper: "before:border-slate-500",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                  {options.map((ext) => (
                    <div
                      key={ext}
                      onClick={() => toggleExtension(category, ext)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                        selected.includes(ext)
                          ? "bg-slate-600/30 border-slate-500/50 text-slate-100"
                          : "bg-slate-800/30 border-slate-700/30 text-slate-400 hover:bg-slate-700/30 hover:text-slate-300"
                      }`}
                    >
                      <Checkbox
                        isSelected={selected.includes(ext)}
                        size="sm"
                        color="success"
                        classNames={{
                          wrapper: "before:border-slate-500",
                        }}
                      />
                      <Typography as="span" variant="mono" className="text-xs">
                        {ext}
                      </Typography>
                    </div>
                  ))}
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Ignored Folders Section */}
      <div className="space-y-4">
        <div>
          <Typography as="p" variant="caption" className="text-slate-400 tracking-wider font-bold mb-1">
            Ignored Folders
          </Typography>
          <Typography as="p" variant="body-sm" className="text-[10px] text-slate-500">
            These folders will be skipped during scanning (e.g., dependencies, system folders)
          </Typography>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add folder name (e.g. node_modules)"
            value={ignoreInput}
            onValueChange={setIgnoreInput}
            onKeyDown={handleKeyDown}
            variant="bordered"
            radius="lg"
            size="md"
            classNames={{
              input: "text-slate-200 font-medium text-sm",
              inputWrapper:
                "bg-slate-800/50 border-slate-600/50 hover:border-slate-500 group-data-[focus=true]:border-slate-400 h-12",
            }}
          />
          <Button
            size="md"
            variant="flat"
            onPress={handleAddIgnore}
            isDisabled={!ignoreInput.trim()}
            className="bg-slate-600 text-slate-100 font-medium min-w-[100px] h-12"
            startContent={<Plus size={16} />}
          >
            <Typography as="span" variant="body" className="text-sm text-slate-100">
              Add
            </Typography>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 min-h-[40px]">
          {ignoredDirs.length === 0 ? (
            <Typography as="p" variant="body-sm" className="text-xs text-slate-500 italic">
              No folders ignored. Add folders to exclude from scanning.
            </Typography>
          ) : (
            ignoredDirs.map((dir) => (
              <Chip
                key={dir}
                variant="flat"
                className="bg-slate-700/50 border border-slate-600/30 text-slate-200 px-1"
                classNames={{
                  content: "text-xs font-mono",
                }}
                onClose={() => onRemoveIgnoreDir(dir)}
              >
                <Typography as="span" variant="mono" className="text-xs">
                  {dir}
                </Typography>
              </Chip>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
