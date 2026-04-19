//go:build windows

package routes

import "fmt"

func diskUsageForPath(targetPath string) (total int64, free int64, used int64, err error) {
	return 0, 0, 0, fmt.Errorf("disk usage is not available on windows")
}
