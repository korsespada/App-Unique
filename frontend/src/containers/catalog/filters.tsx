import { SearchOutlined } from "@ant-design/icons";
import { Button, Input, Select } from "antd";

interface CatalogFiltersProps {
  onSearch: (value: string) => void;
  onCategoryChange: (value: string | undefined) => void;
  selectedCategory: string | undefined;
  categories: string[];
  onBrandLineChange: (value: string | undefined) => void;
  selectedBrandLine: string | undefined;
  brandLines: string[];
  searchQuery: string;
  onClearFilters: () => void;
}

export default function CatalogFilters({
  onSearch,
  onCategoryChange,
  selectedCategory,
  categories,
  onBrandLineChange,
  selectedBrandLine,
  brandLines,
  searchQuery,
  onClearFilters
}: CatalogFiltersProps) {
  return (
    <div className="sticky top-0 z-10 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <Input
          placeholder="Поиск товаров..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          size="large"
          allowClear
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          placeholder="Категория"
          className="w-full"
          value={selectedCategory}
          onChange={(v) => onCategoryChange(v)}
          options={categories.map((c) => ({ value: c, label: c }))}
          allowClear
        />

        <Select
          placeholder="Бренд"
          className="w-full"
          value={selectedBrandLine}
          onChange={(v) => onBrandLineChange(v)}
          options={brandLines.map((b) => ({ value: b, label: b }))}
          allowClear
        />

        {(selectedCategory || selectedBrandLine || searchQuery) && (
          <Button
            type="text"
            danger
            onClick={onClearFilters}
            className="col-span-1">
            Сбросить фильтры
          </Button>
        )}
      </div>
    </div>
  );
}
