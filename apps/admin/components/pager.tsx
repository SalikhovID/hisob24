import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

// Pager says which records a page shows ("21–40 / 45") and turns pages. It
// closes a list (DataList's footer), whose text style it takes.
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
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="whitespace-nowrap">
        {first}–{last} / {total}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeftIcon />
          Oldingi
        </Button>
        <Button variant="outline" disabled={last >= total} onClick={() => onPage(page + 1)}>
          Keyingi
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
