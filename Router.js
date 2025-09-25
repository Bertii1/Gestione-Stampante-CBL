/**
 * Main Application Router - Refactored
 * Router principale dell'applicazione con architettura modulare
 */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Configuration and utilities
import { config, validateConfig } from "./src/config/app.js";
import { dbManager } from "./src/config/database.js";
import { logger } from "./src/utils/logger.js";
import { handleError, asyncHandler } from "./src/utils/errors.js";

// Middleware
import {
  authenticateToken,
  requireAdmin,
  requireUser,
  optionalAuth,
  rateLimit,
} from "./src/middleware/auth.js";

// Services
import { authService } from "./src/services/authService.js";
import { printerService } from "./src/services/printerService.js";

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Application Class
 */
class Application {
  constructor() {
    this.app = express();
    this.server = null;
  }

  /**
   * Initialize application
   */
  async initialize() {
    try {
      // Validate configuration
      validateConfig();

      // Initialize database
      await dbManager.initialize();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      logger.lifecycle("initialized", {
        version: config.app.version,
        environment: config.server.env,
        port: config.server.port,
      });
    } catch (error) {
      logger.error("Application initialization failed", error);
      throw error;
    }
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Basic middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();

      res.on("finish", () => {
        const duration = Date.now() - start;
        logger.request(req, res, duration);
      });

      next();
    });

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      next();
    });

    // Rate limiting for API routes
    this.app.use("/api/", rateLimit());
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    // Static files
    this.app.use(
      "/App",
      express.static(path.join(__dirname, "Frontend"), {
        maxAge: config.static.maxAge,
        etag: config.static.etag,
        lastModified: config.static.lastModified,
      })
    );

    this.app.use("/Media", express.static(path.join(__dirname, "Media")));

    // Root redirect
    this.app.get("/", (req, res) => {
      res.redirect("/App/home/home.html");
    });

    // Commands configuration
    this.app.get("/commands.json", (req, res) => {
      res.sendFile(path.join(__dirname, "commands.json"));
    });

    // Health check
    this.app.get(
      "/health",
      asyncHandler(async (req, res) => {
        const dbHealth = await dbManager.healthCheck();
        const printerStatus = printerService.getPrinterStatus();

        res.json({
          status: "ok",
          timestamp: new Date().toISOString(),
          version: config.app.version,
          database: dbHealth,
          printer: printerStatus,
        });
      })
    );

    // Authentication routes
    this.setupAuthRoutes();

    // API routes
    this.setupApiRoutes();

    // Print routes
    this.setupPrintRoutes();

    // 404 handler
    // Cattura qualsiasi route non gestita
    this.app.use((req, res) => {
      res.status(404).json({
        error: "Route not found",
        code: "ROUTE_NOT_FOUND",
        path: req.originalUrl,
      });
    });
  }

  /**
   * Setup authentication routes
   */
  setupAuthRoutes() {
    // Login
    this.app.post(
      "/login",
      asyncHandler(async (req, res) => {
        const { username, password, needToken } = req.body;

        // Authenticate user
        const user = await authService.authenticateUser(username, password);

        const responseData = {
          stato: "login succesfull",
          role: user.role,
          username: user.username,
        };

        // Generate jwt token
        responseData.token = authService.generateToken(user);

        res.json(responseData);
      })
    );

    // Token verification
    this.app.post("/api/verify-token", authenticateToken, (req, res) => {
      res.json({
        valid: true,
        user: req.user,
        timestamp: new Date().toISOString(),
      });
    });

    // Legacy new user endpoint (deprecated - use POST /api/users)
    this.app.post(
      "/newUser",
      asyncHandler(async (req, res) => {
        const { username, password, role } = req.body;

        const user = await authService.createUser({ username, password, role });

        res.status(201).json({
          message: "Utente creato",
          id: user.id,
        });
      })
    );
  }

  /**
   * Setup API routes
   */
  setupApiRoutes() {
    // User management routes
    this.setupUserRoutes();
    this.setupHistoryRoutes();
    this.setupTemplateRoutes();
  }

  /**
   * Setup user management routes
   */
  setupUserRoutes() {
    const userRoutes = express.Router();

    // Get all users (admin only)
    userRoutes.get(
      "/",
      authenticateToken,
      requireAdmin,
      asyncHandler(async (req, res) => {
        const users = await authService.getAllUsers();
        res.json({ users });
      })
    );

    // Create new user (admin only)
    userRoutes.post(
      "/",
      authenticateToken,
      requireAdmin,
      asyncHandler(async (req, res) => {
        const { username, password, role } = req.body;

        const user = await authService.createUser({ username, password, role });

        res.status(201).json({
          message: "Utente creato con successo",
          id: user.id,
        });
      })
    );

    // Update user (admin only)
    userRoutes.put(
      "/:id",
      authenticateToken,
      requireAdmin,
      asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updateData = req.body;

        const user = await authService.updateUser(id, updateData, req.user);

        res.json({
          message: "Utente aggiornato con successo",
          user,
        });
      })
    );

    // Delete user (admin only)
    userRoutes.delete(
      "/:id",
      authenticateToken,
      requireAdmin,
      asyncHandler(async (req, res) => {
        const { id } = req.params;

        await authService.deleteUser(id, req.user);

        res.json({
          message: "Utente eliminato con successo",
        });
      })
    );

    this.app.use("/api/users", userRoutes);
  }

  /**
   * Setup history routes
   */
  setupHistoryRoutes() {
    const historyRoutes = express.Router();

    // Get user history (paginated)
    historyRoutes.get(
      "/",
      authenticateToken,
      asyncHandler(async (req, res) => {
        const { page = 1, limit = 20, type } = req.query;
        const offset = (page - 1) * limit;

        let query =
          "SELECT * FROM LABEL_HISTORY WHERE user_id = (SELECT id FROM USERS WHERE username = ?)";
        let queryParams = [req.user.username];

        if (type) {
          query += " AND label_type = ?";
          queryParams.push(type);
        }

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        queryParams.push(parseInt(limit), parseInt(offset));

        const history = await dbManager.executeQuery(query, queryParams);

        // Get total count
        let countQuery =
          "SELECT COUNT(*) as total FROM LABEL_HISTORY WHERE user_id = (SELECT id FROM USERS WHERE username = ?)";
        let countParams = [req.user.username];

        if (type) {
          countQuery += " AND label_type = ?";
          countParams.push(type);
        }

        const countResult = await dbManager.executeQuery(
          countQuery,
          countParams
        );

        res.json({
          history,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            pages: Math.ceil(countResult[0].total / limit),
          },
        });
      })
    );

    // Add to history
    historyRoutes.post(
      "/",
      authenticateToken,
      asyncHandler(async (req, res) => {
        const {
          label_type,
          label_data,
          command_generated,
          template_data,
          status = "success",
          notes,
        } = req.body;

        if (!label_type || !label_data || !command_generated) {
          return res.status(400).json({
            error: "label_type, label_data, and command_generated are required",
          });
        }

        // Get user ID
        const users = await dbManager.executeQuery(
          "SELECT id FROM USERS WHERE username = ?",
          [req.user.username]
        );

        if (users.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        const userId = users[0].id;

        const result = await dbManager.executeQuery(
          "INSERT INTO LABEL_HISTORY (user_id, username, label_type, label_data, command_generated, template_data, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            userId,
            req.user.username,
            label_type,
            label_data,
            command_generated,
            JSON.stringify(template_data || {}),
            status,
            notes,
          ]
        );

        res.status(201).json({
          message: "Entry added to history",
          id: result.insertId,
        });
      })
    );

    // Delete history entry
    historyRoutes.delete(
      "/:id",
      authenticateToken,
      asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Check ownership
        const entries = await dbManager.executeQuery(
          "SELECT id FROM LABEL_HISTORY WHERE id = ? AND username = ?",
          [id, req.user.username]
        );

        if (entries.length === 0) {
          return res.status(404).json({
            error: "History entry not found or unauthorized",
          });
        }

        await dbManager.executeQuery("DELETE FROM LABEL_HISTORY WHERE id = ?", [
          id,
        ]);

        res.json({
          message: "History entry deleted successfully",
        });
      })
    );

    this.app.use("/api/history", historyRoutes);
  }

  /**
   * Setup template routes
   */
  setupTemplateRoutes() {
    const templateRoutes = express.Router();

    // Get templates (public + user's private)
    templateRoutes.get(
      "/",
      authenticateToken,
      asyncHandler(async (req, res) => {
        const templates = await dbManager.executeQuery(
          "SELECT * FROM LABEL_TEMPLATES WHERE is_public = TRUE OR created_by_username = ? ORDER BY is_public DESC, name ASC",
          [req.user.username]
        );

        res.json({ templates });
      })
    );

    // Create template
    templateRoutes.post(
      "/",
      authenticateToken,
      asyncHandler(async (req, res) => {
        const {
          name,
          description,
          template_type,
          template_data,
          command_template,
          is_public = false,
        } = req.body;

        if (!name || !template_type || !template_data || !command_template) {
          return res.status(400).json({
            error:
              "name, template_type, template_data, and command_template are required",
          });
        }

        // Get user ID
        const users = await dbManager.executeQuery(
          "SELECT id FROM USERS WHERE username = ?",
          [req.user.username]
        );

        if (users.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        const userId = users[0].id;

        const result = await dbManager.executeQuery(
          "INSERT INTO LABEL_TEMPLATES (name, description, template_type, template_data, command_template, created_by, created_by_username, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            name,
            description,
            template_type,
            JSON.stringify(template_data),
            command_template,
            userId,
            req.user.username,
            is_public,
          ]
        );

        res.status(201).json({
          message: "Template created successfully",
          id: result.insertId,
        });
      })
    );

    // Update template usage
    templateRoutes.post(
      "/:id/use",
      authenticateToken,
      asyncHandler(async (req, res) => {
        const { id } = req.params;

        await dbManager.executeQuery(
          "UPDATE LABEL_TEMPLATES SET usage_count = usage_count + 1 WHERE id = ?",
          [id]
        );

        res.json({
          message: "Template usage recorded",
        });
      })
    );

    // Export template
    templateRoutes.get(
      "/:id/export",
      authenticateToken,
      asyncHandler(async (req, res) => {
        const { id } = req.params;

        const templates = await dbManager.executeQuery(
          "SELECT * FROM LABEL_TEMPLATES WHERE id = ? AND (is_public = TRUE OR created_by_username = ?)",
          [id, req.user.username]
        );

        if (templates.length === 0) {
          return res.status(404).json({
            error: "Template not found or unauthorized",
          });
        }

        const template = templates[0];

        const exportData = {
          name: template.name,
          description: template.description,
          template_type: template.template_type,
          template_data: JSON.parse(template.template_data),
          command_template: template.command_template,
          exported_at: new Date().toISOString(),
          exported_by: req.user.username,
        };

        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="template_${template.name.replace(
            /[^a-zA-Z0-9]/g,
            "_"
          )}.json"`
        );
        res.json(exportData);
      })
    );

    // Delete template
    templateRoutes.delete(
      "/:id",
      authenticateToken,
      asyncHandler(async (req, res) => {
        const { id } = req.params;

        const result = await dbManager.executeQuery(
          "DELETE FROM LABEL_TEMPLATES WHERE id = ? AND created_by_username = ?",
          [id, req.user.username]
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({
            error: "Template not found or unauthorized",
          });
        }

        res.json({
          message: "Template deleted successfully",
        });
      })
    );

    this.app.use("/api/templates", templateRoutes);
  }

  /**
   * Setup print routes
   */
  setupPrintRoutes() {
    // Print endpoint
    this.app.post(
      "/print",
      optionalAuth,
      asyncHandler(async (req, res) => {
        const { cmd, label_type, label_data, template_data, label_quantity } = req.body;

        // Print the label
        const printResult = await printerService.printLabel({
          cmd,
          label_quantity,
          label_data
        });

        // Save to history if authenticated
        if (req.user && label_type && label_data) {
          try {
            // Get user ID
            const users = await dbManager.executeQuery(
              "SELECT id FROM USERS WHERE username = ?",
              [req.user.username]
            );

            if (users.length > 0) {
              const userId = users[0].id;

              await dbManager.executeQuery(
                "INSERT INTO LABEL_HISTORY (user_id, username, label_type, label_data, command_generated, template_data, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  userId,
                  req.user.username,
                  label_type,
                  label_data,
                  cmd,
                  JSON.stringify(template_data || {}),
                  printResult.success ? "success" : "failed",
                  printResult.success ? null : printResult.error,
                ]
              );
            }
          } catch (historyError) {
            logger.warn("Failed to save print to history", {
              user: req.user?.username,
              error: historyError.message,
            });
            // Don't fail the print job for history errors
          }
        }

        res.json({
          success: printResult.success,
          message: printResult.message,
          duration: printResult.duration,
        });
      })
    );

    // Test printer connection
    this.app.get(
      "/printer/test",
      authenticateToken,
      requireAdmin,
      asyncHandler(async (req, res) => {
        const testResult = await printerService.testConnection();
        res.json(testResult);
      })
    );

    // Get printer status
    this.app.get("/printer/status", authenticateToken, (req, res) => {
      const status = printerService.getPrinterStatus();
      res.json(status);
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler
    this.app.use(handleError);

    // Unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      let safeReason;
      try {
        if (reason instanceof Error) {
          safeReason = {
            name: reason.name,
            message: reason.message,
            stack: reason.stack,
          };
        } else if (typeof reason === "object" && reason !== null) {
          // Attempt safe serialization for non-Error objects
          safeReason = JSON.parse(JSON.stringify(reason));
        } else {
          safeReason = String(reason);
        }
      } catch (e) {
        safeReason = { type: typeof reason };
      }

      logger.error("Unhandled Promise Rejection", {
        reason: safeReason,
        // Avoid logging the raw Promise object; it's not informative when stringified
        promise: { state: "unhandled" },
      });
    });

    // Uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception", error);
      process.exit(1);
    });
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(config.server.port, () => {
        logger.lifecycle("started", {
          port: config.server.port,
          environment: config.server.env,
          pid: process.pid,
        });
        console.log(
          `🚀 Server running on http://localhost:${config.server.port}`
        );
      });

      return this.server;
    } catch (error) {
      logger.error("Failed to start server", error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.lifecycle("stopped");
          resolve();
        });
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.lifecycle("shutdown_started");

    try {
      await this.stop();
      await dbManager.close();
      logger.lifecycle("shutdown_completed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", error);
      process.exit(1);
    }
  }
}

// Create and start application
const app = new Application();

// Graceful shutdown handlers
process.on("SIGTERM", () => app.shutdown());
process.on("SIGINT", () => app.shutdown());

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  app.start().catch((error) => {
    console.error("Failed to start application:", error);
    process.exit(1);
  });
}

export default app;
