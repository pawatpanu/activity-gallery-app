package database

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/photoview/photoview/api/utils"
	"gorm.io/gorm"
)

func TestConfigureDatabaseRejectsInvalidDriver(t *testing.T) {
	t.Setenv(utils.EnvDatabaseDriver.GetName(), "oracle")

	_, err := ConfigureDatabase(&gorm.Config{})
	if err == nil {
		t.Fatal("expected invalid database driver to return an error")
	}
	if !strings.Contains(err.Error(), utils.EnvDatabaseDriver.GetName()) {
		t.Fatalf("expected error to mention %s, got %v", utils.EnvDatabaseDriver.GetName(), err)
	}
}

func TestGetSqliteAddressCreatesParentDirectory(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "nested", "sqlite", "photoview.db")

	_, err := GetSqliteAddress(dbPath)
	if err != nil {
		t.Fatalf("expected sqlite address to be created successfully, got %v", err)
	}

	if _, err := os.Stat(filepath.Dir(dbPath)); err != nil {
		t.Fatalf("expected sqlite parent directory to exist, got %v", err)
	}
}
