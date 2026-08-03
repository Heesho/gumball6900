#!/usr/bin/env node

const variableNames = process.argv.slice(2);
if (variableNames.length === 0) throw new Error('At least one environment-variable name is required for redaction');

const values = [];
for (const name of variableNames) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error(`Unsafe environment-variable name: ${name}`);
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`Redaction value is missing: ${name}`);
  values.push({ name, value });
}

let output = '';
for await (const chunk of process.stdin) output += chunk;
for (const { name, value } of values) output = output.split(value).join(`[REDACTED:${name}]`);
process.stdout.write(output);
