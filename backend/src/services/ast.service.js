import * as babelParser from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;

export const astService = {
  /**
   * Check whether the file is a supported JavaScript or TypeScript source file
   */
  isSupported(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    return /\.(jsx?|tsx?|mjs|cjs)$/i.test(filePath);
  },

  /**
   * Extract enclosing symbol details (class, function, method, scope) for given line range
   * @param {string} code - Whole file source code or snippet
   * @param {number} startLine - Conflict start line (1-indexed)
   * @param {number} endLine - Conflict end line (1-indexed)
   * @param {string} filePath - Path of the file
   * @returns {Object|null} Symbol context or null if not applicable / parse error
   */
  extractSymbolContext(code, startLine, endLine, filePath = '') {
    if (!this.isSupported(filePath) || !code || typeof code !== 'string') {
      return null;
    }

    try {
      const isTypeScript = /\.(tsx?)$/i.test(filePath);
      const isJsx = /\.(jsx|tsx)$/i.test(filePath);

      const ast = babelParser.parse(code, {
        sourceType: 'unambiguous',
        errorRecovery: true,
        plugins: [
          isTypeScript ? 'typescript' : null,
          isJsx ? 'jsx' : null,
          'classProperties',
          'classPrivateProperties',
          'classPrivateMethods',
          'decorators-legacy',
          'asyncGenerators',
          'dynamicImport',
          'exportDefaultFrom',
          'nullishCoalescingOperator',
          'optionalChaining',
          'topLevelAwait',
        ].filter(Boolean),
      });

      let enclosingScope = null;
      let enclosingFunction = null;
      let enclosingClass = null;
      let nodeType = null;
      let nodeLoc = null;

      traverse(ast, {
        enter(path) {
          const loc = path.node.loc;
          if (!loc) return;

          // Check if the conflict lines overlap with this AST node
          if (loc.start.line <= startLine && loc.end.line >= endLine) {
            // Check for class declaration or class expression
            if (path.isClassDeclaration() || path.isClassExpression()) {
              enclosingClass = path.node.id?.name || 'AnonymousClass';
              nodeType = 'Class';
              nodeLoc = { start: loc.start.line, end: loc.end.line };
            }

            // Check for function declaration, expression, arrow function, or method
            if (
              path.isFunctionDeclaration() ||
              path.isFunctionExpression() ||
              path.isArrowFunctionExpression() ||
              path.isClassMethod() ||
              path.isObjectMethod()
            ) {
              let fnName = 'anonymous';
              if (path.node.id?.name) {
                fnName = path.node.id.name;
              } else if (path.node.key?.name) {
                fnName = path.node.key.name;
              } else if (path.parentPath?.isVariableDeclarator()) {
                fnName = path.parentPath.node.id?.name || 'anonymous';
              } else if (path.parentPath?.isAssignmentExpression()) {
                fnName = path.parentPath.node.left?.name || 'anonymous';
              }

              enclosingFunction = fnName;
              nodeType = path.node.type;
              nodeLoc = { start: loc.start.line, end: loc.end.line };
            }
          }
        },
      });

      if (!enclosingFunction && !enclosingClass) {
        return null;
      }

      const scopeParts = [];
      if (enclosingClass) scopeParts.push(enclosingClass);
      if (enclosingFunction) scopeParts.push(enclosingFunction);

      return {
        scope: scopeParts.join('.'),
        enclosingFunction: enclosingFunction || null,
        enclosingClass: enclosingClass || null,
        nodeType: nodeType || 'Block',
        startLine: nodeLoc?.start || null,
        endLine: nodeLoc?.end || null,
      };
    } catch (err) {
      // Gracefully handle syntax errors without failing the merge analysis
      return null;
    }
  },
};

export default astService;
