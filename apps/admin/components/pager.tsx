import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

// pageNumbers is the row of page buttons for page of totalPages: every page
// while there are five or fewer; otherwise the first, the last and the
// current one with its neighbours, an ellipsis standing for the pages left
// out on either side.
export function pageNumbers(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages: (number | "ellipsis")[] = [1]
  if (page > 3) pages.push("ellipsis")
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i += 1) pages.push(i)
  if (page < totalPages - 2) pages.push("ellipsis")
  pages.push(totalPages)
  return pages
}

// Pager closes a list (DataList's footer, whose text style it takes). A
// list that fits one page says its total alone. A longer one says how many
// of its records this page shows and turns pages: back, forward, or
// straight to a number. The buttons keep their ink, or a live one would
// read as the disabled one.
export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  if (total <= pageSize) return <span>Jami: {total}</span>
  const totalPages = Math.ceil(total / pageSize)
  const count = Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize))
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className="whitespace-nowrap">
        {total} tadan {count} ta ko&apos;rsatilmoqda
      </span>
      <Pagination aria-label="Sahifalar" className="mx-0 ml-auto w-auto justify-end text-foreground">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious aria-label="Oldingi" disabled={page <= 1} onClick={() => onPage(page - 1)} />
          </PaginationItem>
          {pageNumbers(page, totalPages).map((number, index) =>
            number === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis text="Yana sahifalar" />
              </PaginationItem>
            ) : (
              <PaginationItem key={number}>
                <PaginationLink isActive={number === page} onClick={() => onPage(number)}>
                  {number}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext aria-label="Keyingi" disabled={page >= totalPages} onClick={() => onPage(page + 1)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
