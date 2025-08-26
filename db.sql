-- Crear la base de datos
CREATE DATABASE test_api;

-- Usar la base de datos
USE test_api;

-- Crear tabla de clientes
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    fecha_registro DATE
);

-- Crear tabla de transacciones
CREATE TABLE transacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    descripcion VARCHAR(255),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Insertar datos de ejemplo en clientes
INSERT INTO clientes (nombre, email) VALUES
('Juan Pérez', 'juan@example.com'),
('María López', 'maria@example.com'),
('Carlos Gómez', 'carlos@example.com'),
('Ana Martínez', 'ana@example.com'),
('Luis Rodríguez', 'luis@example.com');

-- Insertar datos de ejemplo en transacciones
INSERT INTO transacciones (cliente_id, monto, descripcion) VALUES
(1, 100.50, 'Compra en tienda'),
(1, 200.00, 'Pago de servicio'),
(2, 50.75, 'Transferencia'),
(3, 300.00, 'Venta'),
(5, 150.25, 'Reembolso');


SELECT * FROM clientes;
