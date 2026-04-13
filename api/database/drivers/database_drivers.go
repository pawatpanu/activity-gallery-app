package drivers

import (
	"fmt"
	"strings"

	"github.com/photoview/photoview/api/utils"
	"gorm.io/gorm"
)

// DatabaseDriverType represents the name of a database driver
type DatabaseDriverType string

const (
	MYSQL    DatabaseDriverType = "mysql"
	SQLITE   DatabaseDriverType = "sqlite"
	POSTGRES DatabaseDriverType = "postgres"
)

func DatabaseDriverFromEnv() DatabaseDriverType {
	driver, err := ParseDatabaseDriverFromEnv()
	if err != nil {
		return MYSQL
	}
	return driver
}

func ParseDatabaseDriverFromEnv() (DatabaseDriverType, error) {
	var driver DatabaseDriverType
	driverString := strings.ToLower(utils.EnvDatabaseDriver.GetValue())

	switch driverString {
	case "", "mysql":
		driver = MYSQL
	case "sqlite":
		driver = SQLITE
	case "postgres":
		driver = POSTGRES
	default:
		return "", fmt.Errorf("unsupported database driver %q in %s (supported: mysql, sqlite, postgres)",
			utils.EnvDatabaseDriver.GetValue(), utils.EnvDatabaseDriver.GetName())
	}

	return driver, nil
}

func (driver DatabaseDriverType) MatchDatabase(db *gorm.DB) bool {
	return db.Dialector.Name() == string(driver)
}

func GetDatabaseDriverType(db *gorm.DB) (driver DatabaseDriverType) {
	switch db.Dialector.Name() {
	case "mysql":
		driver = MYSQL
	case "sqlite":
		driver = SQLITE
	case "postgres":
		driver = POSTGRES
	default:
		driver = MYSQL
	}

	return
}
