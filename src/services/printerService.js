/**
 * Printer Service
 * Servizio per la gestione della stampante via Telnet
 */
import { Telnet } from 'telnet-client';
import { config } from '../config/app.js';
import { logger } from '../utils/logger.js';
import { PrinterError } from '../utils/errors.js';

class PrinterService {
  constructor() {
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = config.printer.retryAttempts || 1;
    this.retryDelay = config.printer.retryDelay || 2000;
  }

  /**
   * Crea una nuova connessione Telnet
   */
  createConnection() {
    const connection = new Telnet();
    
    connection.on('data', (data) => {
      logger.debug('Printer response received', {
        data: data.toString().trim(),
        length: data.length
      });
    });

    connection.on('error', (error) => {
      logger.error('Printer connection error', {
        error: error.message,
        host: config.printer.host,
        port: config.printer.port
      });
    });

    connection.on('close', () => {
      logger.debug('Printer connection closed');
      this.isConnected = false;
    });

    return connection;
  }

  /**
   * Connetti alla stampante con retry automatico
   */
  async connect(retryCount = 0) {
    const connection = this.createConnection();

    try {
      await connection.connect({
        host: config.printer.host,
        port: config.printer.port,
        timeout: config.printer.timeout || 30000,
        negotiationMandatory: false
      });

      this.isConnected = true;
      this.connectionRetries = 0;
      
      logger.info('Printer connected successfully', {
        host: config.printer.host,
        port: config.printer.port,
        attempt: retryCount + 1
      });

      return connection;
    } catch (error) {
      await connection.destroy();

      if (retryCount < this.maxRetries) {
        logger.warn(`Printer connection failed, retrying in ${this.retryDelay}ms`, {
          attempt: retryCount + 1,
          maxRetries: this.maxRetries,
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect(retryCount + 1);
      }

      throw new PrinterError(
        `Failed to connect to printer after ${this.maxRetries + 1} attempts`,
        {
          host: config.printer.host,
          port: config.printer.port,
          lastError: error.message
        }
      );
    }
  }

  /**
   * Invia comando alla stampante
   */
  async sendCommand(connection, command, quantity) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new PrinterError('Command timeout'));
      }, 5000);

      try {
        // Send the main command
        connection.write(`${command}\r\n`);
        
        // Send print command after a short delay
        setTimeout(() => {
          connection.write(`P1,${quantity}\r\n`);
          clearTimeout(timeout);
          resolve();
        }, 200);
      } catch (error) {
        clearTimeout(timeout);
        reject(new PrinterError(`Failed to send command: ${error.message}`));
      }
    });
  }

  /**
   * Stampa etichetta
   */
  async printLabel(labelData) {
    const startTime = Date.now();
    let connection = null;

    try {
      const { cmd, label_type, label_data, template_data, label_quantity } = labelData;

      logger.print('started', labelData);

      // Validate command
      if (!cmd || cmd.trim().length === 0) {
        throw new PrinterError('Print command is required');
      }

      // Connect to printer
      connection = await this.connect();

      // Send command
      await this.sendCommand(connection,cmd,label_quantity);

      const duration = Date.now() - startTime;
      logger.print('completed', labelData, true);
      logger.performance('print_operation', duration);

      return {
        success: true,
        duration,
        command: cmd,
        message: 'Print job completed successfully'
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.print('failed', labelData, false, error);
      
      throw new PrinterError(
        `Print operation failed: ${error.message}`,
        {
          command: labelData.cmd,
          duration,
          originalError: error.message
        }
      );
    } finally {
      if (connection) {
        try {
          await connection.destroy();
        } catch (closeError) {
          logger.warn('Error closing printer connection', { error: closeError.message });
        }
      }
    }
  }

  /**
   * Test connessione stampante
   */
  async testConnection() {
    let connection = null;
    const startTime = Date.now();

    try {
      connection = await this.connect();
      const duration = Date.now() - startTime;

      logger.info('Printer connection test successful', {
        host: config.printer.host,
        port: config.printer.port,
        duration: `${duration}ms`
      });

      return {
        success: true,
        host: config.printer.host,
        port: config.printer.port,
        duration,
        message: 'Printer connection test successful'
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Printer connection test failed', {
        host: config.printer.host,
        port: config.printer.port,
        duration: `${duration}ms`,
        error: error.message
      });

      return {
        success: false,
        host: config.printer.host,
        port: config.printer.port,
        duration,
        error: error.message,
        message: 'Printer connection test failed'
      };
    } finally {
      if (connection) {
        try {
          await connection.destroy();
        } catch (closeError) {
          logger.warn('Error closing test connection', { error: closeError.message });
        }
      }
    }
  }

  /**
   * Ottieni stato stampante
   */
  getPrinterStatus() {
    return {
      host: config.printer.host,
      port: config.printer.port,
      connected: this.isConnected,
      retryAttempts: this.maxRetries,
      retryDelay: this.retryDelay,
      timeout: config.printer.timeout
    };
  }

  /**
   * Valida comando di stampa
   */
  validatePrintCommand(command) {
    if (!command || typeof command !== 'string') {
      throw new PrinterError('Print command must be a non-empty string');
    }

    const trimmedCommand = command.trim();
    if (trimmedCommand.length === 0) {
      throw new PrinterError('Print command cannot be empty');
    }

    // Basic command format validation
    const validCommands = ['B1', 'B2', 'IMG', 'T', 'A', 'R'];
    const commandStart = trimmedCommand.substring(0, 3);
    
    if (!validCommands.some(cmd => trimmedCommand.startsWith(cmd))) {
      logger.warn('Potentially invalid print command', {
        command: commandStart,
        validCommands
      });
    }

    return trimmedCommand;
  }

  /**
   * Formatta comando per logging sicuro
   */
  safeCommandString(command, maxLength = 100) {
    if (!command) return 'NO_COMMAND';
    
    const safe = command.substring(0, maxLength);
    return safe + (command.length > maxLength ? '...' : '');
  }
}

// Singleton instance
const printerService = new PrinterService();

export { printerService };
export default printerService;