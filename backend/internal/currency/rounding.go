package currency

import "math"

// roundRate is a bank's rate rounded to the company's step, the nearest
// multiple, a half away from zero (tw-dobroe's RoundToStep): 12014.37 to
// 100 is 12000; a step of 1 keeps the rate as the bank gives it.
func roundRate(v float64, step int32) float64 {
	if step <= 1 {
		return v
	}
	s := float64(step)
	return math.Round(v/s) * s
}
