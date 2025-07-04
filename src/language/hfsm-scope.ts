import { AstNode, AstNodeDescription, AstUtils, Cancellation, DefaultScopeComputation, DefaultScopeProvider, interruptAndCheck, LangiumDocument, ReferenceInfo, Scope } from "langium";
import { HfsmServices } from "./hfsm-module.js";
import { isState } from "./generated/ast.js";
import { LangiumServices } from "langium/lsp";

export class HfsmScopeComputation extends DefaultScopeComputation {
    constructor(services: HfsmServices) {
        super(services);
    }

    override async computeExports(document: LangiumDocument, cancelToken = Cancellation.CancellationToken.None): Promise<AstNodeDescription[]> {
        const descriptors: AstNodeDescription[] = [];

        for (const node of AstUtils.streamAllContents(document.parseResult.value)) {
            await interruptAndCheck(cancelToken);

            if (isState(node)) {
                const qualifiedName = this.getQualifiedName(node, node.name);
                descriptors.push(this.descriptions.createDescription(node, qualifiedName, document));
            }
        }

        return descriptors;
    }

    private getQualifiedName(node: AstNode, name: string): string {
        let parent: AstNode | undefined = node.$container?.$container;
        
        while (isState(parent)) {
            name = `${parent.name}.${name}`;
            parent = parent.$container?.$container;
        }
        
        return name;
    }
}

export class HfsmScopeProvider extends DefaultScopeProvider {
    constructor(services: LangiumServices) {
        super(services);
    }

    override getScope(context: ReferenceInfo): Scope {
        // Always resolve from the document root, ignoring local scopes.
        const document = AstUtils.getDocument(context.container);
        const stateDescriptions = this.indexManager.allElements("State").filter(desc => desc.documentUri.toString() === document.uri.toString());
        return this.createScope(stateDescriptions);
    }
}
