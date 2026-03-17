-- Crear base de datos
IF DB_ID('puravia') IS NULL
    CREATE DATABASE puravia;
GO
USE puravia;
GO

-- Limpieza idempotente
IF OBJECT_ID('dbo.orden_detalle', 'U') IS NOT NULL DROP TABLE dbo.orden_detalle;
IF OBJECT_ID('dbo.orden', 'U') IS NOT NULL DROP TABLE dbo.orden;
IF OBJECT_ID('dbo.reserva', 'U') IS NOT NULL DROP TABLE dbo.reserva;
IF OBJECT_ID('dbo.producto', 'U') IS NOT NULL DROP TABLE dbo.producto;
IF OBJECT_ID('dbo.mesa', 'U') IS NOT NULL DROP TABLE dbo.mesa;
IF OBJECT_ID('dbo.mesero', 'U') IS NOT NULL DROP TABLE dbo.mesero;
IF OBJECT_ID('dbo.usuario', 'U') IS NOT NULL DROP TABLE dbo.usuario;
GO

-- Usuarios de la app (login/rol)
CREATE TABLE dbo.usuario (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    username         VARCHAR(50) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    rol              VARCHAR(20) NOT NULL DEFAULT ('mesero'), -- admin | mesero
    activo           BIT NOT NULL DEFAULT (1),
    creado_en        DATETIME2 NOT NULL DEFAULT (SYSDATETIME())
);

-- Meseros (perfil + FK a usuario)
CREATE TABLE dbo.mesero (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    nombre           VARCHAR(120) NOT NULL,
    identificacion   VARCHAR(30)  NOT NULL UNIQUE,
    telefono         VARCHAR(20)  NULL,
    correo           VARCHAR(120) NULL,
    turno            VARCHAR(20)  NOT NULL, -- Mañana/Tarde/Noche/etc.
    usuario_id       INT NOT NULL,
    observaciones    VARCHAR(400) NULL,
    creado_en        DATETIME2 NOT NULL DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_mesero_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuario(id)
);

-- Mesas
CREATE TABLE dbo.mesa (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    numero       INT NOT NULL UNIQUE,
    capacidad    INT NOT NULL DEFAULT (4),
    estado       VARCHAR(15) NOT NULL DEFAULT ('libre'), -- libre/ocupada/reservada
    ubicacion    VARCHAR(50) NULL,
    nota         VARCHAR(200) NULL
);

-- Productos
CREATE TABLE dbo.producto (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    nombre       VARCHAR(120) NOT NULL,
    descripcion  VARCHAR(400) NULL,
    categoria    VARCHAR(60) NOT NULL,
    precio       DECIMAL(10,2) NOT NULL,
    activo       BIT NOT NULL DEFAULT (1),
    creado_en    DATETIME2 NOT NULL DEFAULT (SYSDATETIME())
);

-- Órdenes
CREATE TABLE dbo.orden (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    mesa_id       INT NOT NULL,
    mesero_id     INT NOT NULL,
    estado        VARCHAR(15) NOT NULL DEFAULT ('abierta'), -- abierta/cerrada/cancelada
    total         DECIMAL(12,2) NOT NULL DEFAULT (0),
    creada_en     DATETIME2 NOT NULL DEFAULT (SYSDATETIME()),
    cerrada_en    DATETIME2 NULL,
    CONSTRAINT FK_orden_mesa   FOREIGN KEY (mesa_id)   REFERENCES dbo.mesa(id),
    CONSTRAINT FK_orden_mesero FOREIGN KEY (mesero_id) REFERENCES dbo.mesero(id)
);

-- Detalle de Órdenes
CREATE TABLE dbo.orden_detalle (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    orden_id       INT NOT NULL,
    producto_id    INT NOT NULL,
    cantidad       INT NOT NULL CHECK (cantidad > 0),
    precio_unit    DECIMAL(10,2) NOT NULL,
    subtotal       AS (cantidad * precio_unit) PERSISTED,
    CONSTRAINT FK_det_orden    FOREIGN KEY (orden_id)    REFERENCES dbo.orden(id),
    CONSTRAINT FK_det_producto FOREIGN KEY (producto_id) REFERENCES dbo.producto(id)
);

-- Reservas de mesas
CREATE TABLE dbo.reserva (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    mesa_id           INT NOT NULL,
    cliente_nombre    VARCHAR(120) NOT NULL,
    cliente_telefono  VARCHAR(20)  NULL,
    fecha_hora        DATETIME2 NOT NULL,
    cantidad_personas INT NOT NULL,
    estado            VARCHAR(15) NOT NULL DEFAULT ('pendiente'), -- pendiente/confirmada/cancelada
    nota              VARCHAR(200) NULL,
    creada_en         DATETIME2 NOT NULL DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_reserva_mesa FOREIGN KEY (mesa_id) REFERENCES dbo.mesa(id)
);

-------------------------------------------------------
-- Datos de ejemplo
-------------------------------------------------------
-- Usuarios (password_hash solo de ejemplo; reemplaza por hash real)
INSERT INTO dbo.usuario (username, password_hash, rol)
VALUES ('admin', 'admin_hash', 'admin'),
       ('asolís', 'pass_hash', 'mesero'),
       ('cjimenez', 'pass_hash', 'mesero'),
       ('laraya', 'pass_hash', 'mesero');

-- Meseros
INSERT INTO dbo.mesero (nombre, identificacion, telefono, correo, turno, usuario_id)
SELECT 'Andrea Solís', '1-2345-6789', '8888-0001', 'andrea@puravia.cr', 'Mañana', u.id FROM dbo.usuario u WHERE u.username = 'asolís'
UNION ALL
SELECT 'Carlos Jiménez', '2-3456-7890', '8888-0002', 'carlos@puravia.cr', 'Tarde', u.id FROM dbo.usuario u WHERE u.username = 'cjimenez'
UNION ALL
SELECT 'Lucía Araya', '3-4567-8901', '8888-0003', 'lucia@puravia.cr', 'Noche', u.id FROM dbo.usuario u WHERE u.username = 'laraya';

-- Mesas (12 mesas)
INSERT INTO dbo.mesa (numero, capacidad, estado)
SELECT v.n, 4, 'libre'
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12)) v(n);

-- Productos de muestra
INSERT INTO dbo.producto (nombre, descripcion, categoria, precio) VALUES
('Entrada de ceviche', 'Ceviche de pescado fresco', 'Entradas', 5500),
('Ensalada PuraVia', 'Verdes orgánicas con aderezo de la casa', 'Entradas', 4800),
('Pasta al pesto', 'Pasta artesanal con pesto de albahaca', 'Platos fuertes', 8500),
('Filete de res', 'Corte angus con salsa de vino', 'Platos fuertes', 12500),
('Cheesecake maracuyá', 'Postre casero', 'Postres', 4200),
('Café chorreado', 'Café de especialidad', 'Bebidas', 1800);

-- Orden y detalle de ejemplo (Mesa 1, mesero Andrea)
DECLARE @ordenId INT;
INSERT INTO dbo.orden (mesa_id, mesero_id, estado) 
VALUES ((SELECT id FROM dbo.mesa WHERE numero = 1),
        (SELECT TOP 1 id FROM dbo.mesero WHERE nombre = 'Andrea Solís'),
        'abierta');
SET @ordenId = SCOPE_IDENTITY();

INSERT INTO dbo.orden_detalle (orden_id, producto_id, cantidad, precio_unit)
SELECT @ordenId, p.id, 2, p.precio FROM dbo.producto p WHERE p.nombre = 'Café chorreado'
UNION ALL
SELECT @ordenId, p.id, 1, p.precio FROM dbo.producto p WHERE p.nombre = 'Pasta al pesto';

-- Reserva de ejemplo
INSERT INTO dbo.reserva (mesa_id, cliente_nombre, cliente_telefono, fecha_hora, cantidad_personas, estado)
VALUES ((SELECT id FROM dbo.mesa WHERE numero = 5), 'María López', '8888-1212', DATEADD(HOUR, 2, SYSDATETIME()), 2, 'confirmada');
GO
