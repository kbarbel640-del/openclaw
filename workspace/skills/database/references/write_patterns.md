# WriteIntent Patterns

Every write uses the same WriteIntent format — even single-row creates.

## 1. Single Row Create

```json
{
  "goal": "Create new UoM entry for Metric Ton",
  "reasoning": "No existing MT entry found. Standard weight unit needed.",
  "operations": [
    {
      "action": "create",
      "table": "uom",
      "data": {
        "code": "MT",
        "name": "Metric Ton",
        "uom_category": "WEIGHT",
        "is_base_unit": false,
        "decimal_places": 3
      }
    }
  ],
  "impact": {"creates": {"uom": 1}}
}
```

Note: `id` and `created_at` are auto-generated.

## 2. Multi-Table: Product Family + Variants

```json
{
  "goal": "Create PET Bottles family with size variants and 4 products",
  "reasoning": "Duplicate check: 0 matches for SKU prefix PET. Research complete.",
  "operations": [
    {
      "action": "create",
      "table": "product_families",
      "data": {
        "name": "PET Bottles",
        "sku_prefix": "PET",
        "brand": "AquaPure",
        "base_price": 25.00,
        "lifecycle_stage": "active"
      },
      "returns": "family"
    },
    {
      "action": "create",
      "table": "variant_axes",
      "data": [
        {"product_family_id": "@family.id", "name": "size", "display_label": "Size", "sort_order": 1}
      ],
      "returns": "axes"
    },
    {
      "action": "create",
      "table": "variant_values",
      "data": [
        {"variant_axis_id": "@axes.id", "value": "500ml", "sku_code": "500ML"},
        {"variant_axis_id": "@axes.id", "value": "1L", "sku_code": "1L"},
        {"variant_axis_id": "@axes.id", "value": "2L", "sku_code": "2L"},
        {"variant_axis_id": "@axes.id", "value": "5L", "sku_code": "5L"}
      ],
      "returns": "values"
    },
    {
      "action": "create",
      "table": "products",
      "data": [
        {"product_family_id": "@family.id", "sku": "PET-500ML", "name": "PET Bottle 500ml", "price": 15},
        {"product_family_id": "@family.id", "sku": "PET-1L", "name": "PET Bottle 1L", "price": 25},
        {"product_family_id": "@family.id", "sku": "PET-2L", "name": "PET Bottle 2L", "price": 40},
        {"product_family_id": "@family.id", "sku": "PET-5L", "name": "PET Bottle 5L", "price": 80}
      ]
    }
  ],
  "impact": {
    "creates": {"product_families": 1, "variant_axes": 1, "variant_values": 4, "products": 4}
  }
}
```

Dependencies are **auto-detected** from `@family.id` and `@axes.id` references.

## 3. Update with Filters

```json
{
  "goal": "Increase prices by 10% for all PET Bottle products",
  "reasoning": "Price revision approved. Affects 4 products.",
  "operations": [
    {
      "action": "update",
      "table": "products",
      "filters": {"product_family_id": "uuid-of-pet-family"},
      "updates": {"price": 27.50, "updated_at": "now()"}
    }
  ],
  "impact": {"updates": {"products": 4}}
}
```

## 4. Upsert (Insert or Update)

```json
{
  "goal": "Upsert price list entries for wholesale channel",
  "reasoning": "Some prices may already exist. Using upsert for idempotency.",
  "operations": [
    {
      "action": "upsert",
      "table": "product_prices",
      "data": [
        {"product_id": "uuid-1", "price_list_id": "wholesale-uuid", "price": 20.00},
        {"product_id": "uuid-2", "price_list_id": "wholesale-uuid", "price": 35.00}
      ],
      "on_conflict": "update",
      "conflict_fields": ["product_id", "price_list_id"]
    }
  ],
  "impact": {"creates": {"product_prices": 2}}
}
```

## 5. Soft Delete

```json
{
  "goal": "Discontinue PET 5L product",
  "reasoning": "Product discontinued per business decision. Soft delete to preserve history.",
  "operations": [
    {
      "action": "delete",
      "table": "products",
      "filters": {"sku": "PET-5L"},
      "soft_delete": true
    }
  ],
  "impact": {"deletes": {"products": 1}}
}
```

Soft delete sets `is_active = false` and `deleted_at = now()` instead of removing the row.

## 6. Bulk Create

```json
{
  "goal": "Add 3 new categories for packaging products",
  "reasoning": "Categories needed before creating product families.",
  "operations": [
    {
      "action": "create",
      "table": "categories",
      "data": [
        {"name": "Bottles", "code": "BOTTLES"},
        {"name": "Jars", "code": "JARS"},
        {"name": "Containers", "code": "CONTAINERS"}
      ]
    }
  ],
  "impact": {"creates": {"categories": 3}}
}
```

## Key Rules

1. **Always use WriteIntent format** — even for single row operations
2. **`@name.field` references** are auto-resolved — no need to specify `dependencies` manually
3. **`id`, `created_at`, `updated_at`** are auto-set — don't include unless overriding
4. **Numeric values** are auto-normalized (1.0 → 1 for integer columns)
5. **Use `--dry-run`** to preview before executing
6. **All operations are atomic** — if one fails, everything rolls back
