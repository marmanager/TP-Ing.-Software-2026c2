class PruebasOmitidasReporter {
  onRunComplete(_contextos, resultados) {
    const omitidas = resultados.testResults.flatMap((archivo) =>
      archivo.testResults.filter((prueba) =>
        ["pending", "todo", "disabled"].includes(prueba.status)
      )
    );

    if (!omitidas.length) return;

    const lineas = omitidas.map((prueba) => `  ○ ${prueba.fullName}`);
    process.stdout.write(`\nPruebas omitidas (${omitidas.length}):\n${lineas.join("\n")}\n`);
  }
}

module.exports = PruebasOmitidasReporter;
