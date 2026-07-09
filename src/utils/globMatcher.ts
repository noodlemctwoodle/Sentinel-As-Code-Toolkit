//
// src/utils/globMatcher.ts
//
// Created by Toby G on 09/07/2026.
//

/**
 * Convert a glob pattern into an anchored RegExp.
 * Supports: double-star (matches across path separators), single-star (within a
 * segment), question mark (single non-separator char), and brace alternation
 * such as a,b,c. All other regex metacharacters are matched literally.
 */
export function globToRegExp(glob: string, flags = ''): RegExp {
    let out = '';
    let braceDepth = 0;
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        switch (c) {
            case '*':
                if (glob[i + 1] === '*') {
                    i++;
                    if (glob[i + 1] === '/') {
                        i++;
                        out += '(?:.*/)?';
                    } else {
                        out += '.*';
                    }
                } else {
                    out += '[^/]*';
                }
                break;
            case '?':
                out += '[^/]';
                break;
            case '{':
                braceDepth++;
                out += '(?:';
                break;
            case '}':
                if (braceDepth > 0) {
                    braceDepth--;
                    out += ')';
                } else {
                    out += '\\}';
                }
                break;
            case ',':
                out += braceDepth > 0 ? '|' : ',';
                break;
            case '/':
                out += '/';
                break;
            case '\\':
            case '^':
            case '$':
            case '.':
            case '|':
            case '+':
            case '(':
            case ')':
            case '[':
            case ']':
                out += '\\' + c;
                break;
            default:
                out += c;
        }
    }
    return new RegExp('^' + out + '$', flags);
}

/**
 * Returns true if filePath matches any of the glob patterns. Each pattern is
 * tested against the full (forward-slashed) path and against the basename, so
 * both directory and filename patterns work. Invalid patterns are ignored so a
 * single bad glob never disables matching for the rest.
 */
export function matchesAnyGlob(filePath: string, patterns: string[], caseSensitive = true): boolean {
    if (!patterns || patterns.length === 0) {
        return false;
    }
    const normalized = filePath.replace(/\\/g, '/');
    const basename = normalized.split('/').pop() ?? normalized;
    const flags = caseSensitive ? '' : 'i';
    for (const pattern of patterns) {
        if (!pattern || typeof pattern !== 'string') {
            continue;
        }
        try {
            const regex = globToRegExp(pattern.replace(/\\/g, '/'), flags);
            if (regex.test(normalized) || regex.test(basename)) {
                return true;
            }
        } catch {
            // Ignore invalid patterns rather than breaking validation.
        }
    }
    return false;
}
