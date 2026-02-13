# Query Patterns

## Filters vs Search

**filters** = exact match, operators, IN lists. For IDs, booleans, enums, numbers.
**search** = ILIKE with `%` wildcards. For text/name fuzzy matching.

```bash
# Filters: exact match (strings auto-ilike unless UUID)
--filters '{"is_active": true, "category_id": "uuid-here"}'

# Filters: operators
--filters '{"price": {"gt": 100, "lte": 500}}'

# Filters: IN list
--filters '{"status": ["active", "draft"]}'

# Search: single pattern
--search '{"name": "%bottle%"}'

# Search: OR between patterns
--search '{"name": ["%PET%", "%jar%", "%container%"]}'
```

## Read Examples

### Simple filtered read
```bash
python scripts/db_tool.py read products --filters '{"is_active": true}' --limit 10
```

### Select specific columns
```bash
python scripts/db_tool.py read products --columns 'id,sku,name,price' --limit 50
```

### With relations (PostgREST embedding)
```bash
python scripts/db_tool.py read products --relations 'product_families(name,sku_prefix),product_prices(price,price_lists(name))'
```

### Fuzzy search with pagination
```bash
python scripts/db_tool.py read products --search '{"name": "%PET%"}' --limit 20 --offset 40
```

### Count only
```bash
python scripts/db_tool.py read products --filters '{"is_active": true}' --count-only
```

### Combined filters + search
```bash
python scripts/db_tool.py read products \
  --filters '{"is_active": true}' \
  --search '{"name": ["%bottle%", "%jar%"]}' \
  --columns 'id,sku,name,price' \
  --limit 20
```

## Aggregate Examples

### Simple count
```bash
python scripts/db_tool.py aggregate products --aggregates '{"total": "count(*)"}'
```

### Group by with multiple aggregates
```bash
python scripts/db_tool.py aggregate products \
  --aggregates '{"count": "count(*)", "avg_price": "avg(price)", "max_price": "max(price)"}' \
  --group-by 'product_family_id'
```

### With HAVING filter
```bash
python scripts/db_tool.py aggregate products \
  --aggregates '{"count": "count(*)"}' \
  --filters '{"is_active": true}' \
  --group-by 'product_family_id' \
  --having '{"count": {"gt": 5}}'
```

### With search patterns
```bash
python scripts/db_tool.py aggregate products \
  --aggregates '{"count": "count(*)", "total_value": "sum(price)"}' \
  --search '{"name": "%PET%"}' \
  --group-by 'product_family_id'
```

## Supported Aggregate Functions

- `count(*)` or `count(column)`
- `sum(column)`
- `avg(column)`
- `min(column)`
- `max(column)`

## Filter Operators

| Operator | Meaning |
|----------|---------|
| `gt` | Greater than |
| `gte` | Greater than or equal |
| `lt` | Less than |
| `lte` | Less than or equal |
| `eq` | Equal |
| `neq` | Not equal |
| `in` | In list |
