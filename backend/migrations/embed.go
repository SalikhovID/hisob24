// Package migrations embeds the goose SQL migrations so that tests can apply
// them without depending on the working directory.
package migrations

import "embed"

// FS holds every migration file.
//
//go:embed *.sql
var FS embed.FS
