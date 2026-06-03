package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()
	r.GET("/health", healthHandler)

	v1 := r.Group("/api/v1")
	v1.GET("/users", listUsers)
	v1.POST("/users", createUser)
	v1.GET("/users/:id", getUser)

	admin := v1.Group("/admin")
	admin.DELETE("/users/:id", deleteUser)

	r.Run()
}

// ping calls an external service — http.Get is an HTTP *client* call, not a
// route registration, and must not be mistaken for a route.
func ping() {
	http.Get("https://example.com/ping")
}

func healthHandler(c *gin.Context) {}
func listUsers(c *gin.Context)     {}
func createUser(c *gin.Context)    {}
func getUser(c *gin.Context)       {}
func deleteUser(c *gin.Context)    {}
