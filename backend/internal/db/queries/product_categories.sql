-- name: CreateProductCategory :one
-- A new category goes last in the company's order; 23505 when the name is
-- another live category's (whatever the case).
INSERT INTO product_categories (company_id, name, position)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'),
        COALESCE((SELECT max(c.position) FROM product_categories c
                  WHERE c.company_id = sqlc.arg('company_id') AND c.deleted_at IS NULL), 0) + 1)
RETURNING *;

-- name: ListProductCategories :many
-- The company's live categories, in their order.
SELECT * FROM product_categories
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY position, id;

-- name: GetProductCategory :one
-- The company's live category; pgx.ErrNoRows when it has none such, or
-- deleted it.
SELECT * FROM product_categories WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: RenameProductCategory :one
-- Gives the category another name. pgx.ErrNoRows when the company has no
-- such category, or deleted it; 23505 when the name is another's.
UPDATE product_categories SET name = sqlc.arg('name'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteProductCategory :one
-- Hides the category: nothing is removed, its name is free again.
-- pgx.ErrNoRows when the company has no such category, or deleted it already.
UPDATE product_categories SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: OrderProductCategories :exec
-- Puts the company's categories in the order of ids: the first gets
-- position 1. An id that is not a live category of the company is passed
-- over.
UPDATE product_categories c SET position = n.ord::int
FROM unnest(sqlc.arg('ids')::bigint[]) WITH ORDINALITY AS n(id, ord)
WHERE c.id = n.id AND c.company_id = sqlc.arg('company_id') AND c.deleted_at IS NULL;

-- name: CountCategoryProducts :one
-- How many live products (the inactive ones too) are filed under the
-- category: what keeps it from being deleted.
SELECT count(*) FROM products WHERE category_id = sqlc.arg('category_id')::bigint AND deleted_at IS NULL;
