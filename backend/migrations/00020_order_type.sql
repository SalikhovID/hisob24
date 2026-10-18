-- +goose Up
-- The ready type every company got (logic/orders.md, 3.4) is «Buyurtma», as
-- the section is: a company's live «Vazifa» takes the name, unless the
-- company has a live «Buyurtma» already (a name is one live type's in a
-- company, whatever the case). A deleted type keeps its name.
UPDATE order_types t SET name = 'Buyurtma'
WHERE t.name = 'Vazifa' AND t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM order_types b
                  WHERE b.company_id = t.company_id AND lower(b.name) = 'buyurtma' AND b.deleted_at IS NULL);

-- +goose Down
-- Nothing goes back: which «Buyurtma» was a «Vazifa» is not kept.
SELECT 1;
