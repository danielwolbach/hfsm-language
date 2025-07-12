import type { Model } from "../language/generated/ast.js";
import chalk from "chalk";
import { Command } from "commander";
import { HfsmLanguageMetaData } from "../language/generated/module.js";
import { createHfsmServices } from "../language/hfsm-module.js";
import { extractAstNode } from "./cli-util.js";
import { generateJava } from "./generator.js";
import { NodeFileSystem } from "langium/node";
import * as url from "node:url";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateInspection } from "./inspector.js";
import { runInteraction } from "./interactive.js";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const packagePath = path.resolve(__dirname, "..", "..", "package.json");
const packageContent = await fs.readFile(packagePath, "utf-8");

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createHfsmServices(NodeFileSystem).Hfsm;
    const model = await extractAstNode<Model>(fileName, services);
    const generatedFilePath = generateJava(model, fileName, opts.destination);
    console.log(chalk.green(`Java code generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
};

export const interactAction = async (fileName: string, opts: InteractOptions): Promise<void> => {
    const services = createHfsmServices(NodeFileSystem).Hfsm;
    const model = await extractAstNode<Model>(fileName, services);
    runInteraction(model, opts.query);
};

export type InteractOptions = {
    query?: string;
};

export const inspectAction = async (fileName: string): Promise<void> => {
    const services = createHfsmServices(NodeFileSystem).Hfsm;
    const model = await extractAstNode<Model>(fileName, services);
    const inspectionOutput = generateInspection(model);
    console.log(chalk.green("Inspection output:"));
    console.log(inspectionOutput);
};

export default function (): void {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    const fileExtensions = HfsmLanguageMetaData.fileExtensions.join(", ");

    program
        .command("generate")
        .argument("<file>", `source file (possible file extensions: ${fileExtensions})`)
        .option("-d, --destination <dir>", "destination directory of generating")
        .description("Generate Java code for a state machine that matches the given model")
        .action(generateAction);

    program
        .command("inspect")
        .argument("<file>", `source file (possible file extensions: ${fileExtensions})`)
        .description("Inspect the generated AST for language debugging purposes")
        .action(inspectAction);

    program
        .command("interact")
        .argument("<file>", `source file (possible file extensions: ${fileExtensions})`)
        .option("-q, --query <events>", "event query to run on the state machine")
        .description("Interact with the state machine")
        .action(interactAction);

    program.parse(process.argv);
}
