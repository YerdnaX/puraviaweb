const sqlserver = require('mssql/msnodesqlv8');

const config = {
    connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=puravia;Trusted_Connection=yes;"
};

async function conectar() {
    try {
        await sql.connect(config);
        console.log("Conectado a SQL Server");
    } catch (err) {
        console.log(err);
    }
}

conectar();
module.exports = sqlserver;