//go:build !windows

package routes

import "syscall"

func diskUsageForPath(targetPath string) (total int64, free int64, used int64, err error) {
	var stat syscall.Statfs_t
	if err = syscall.Statfs(targetPath, &stat); err != nil {
		return 0, 0, 0, err
	}

	total = int64(stat.Blocks) * int64(stat.Bsize)
	free = int64(stat.Bavail) * int64(stat.Bsize)
	used = total - free
	return total, free, used, nil
}
