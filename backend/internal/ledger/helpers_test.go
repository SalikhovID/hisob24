package ledger

import (
	"fmt"
	"strings"
)

// join writes values apart by colons, the way the tests read a row.
func join(values ...any) string {
	parts := make([]string, 0, len(values))
	for _, v := range values {
		parts = append(parts, fmt.Sprint(v))
	}
	return strings.Join(parts, ":")
}
