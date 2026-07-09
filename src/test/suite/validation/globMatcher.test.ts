import * as assert from 'assert';
import { matchesAnyGlob, globToRegExp } from '../../../utils/globMatcher';

suite('Glob Matcher Tests', () => {
    test('matches directory patterns with a double-star', () => {
        assert.strictEqual(matchesAnyGlob('Content/test/rule.yaml', ['**/test/**']), true);
        assert.strictEqual(matchesAnyGlob('Content/prod/rule.yaml', ['**/test/**']), false);
    });

    test('matches filename-only patterns against the basename', () => {
        assert.strictEqual(matchesAnyGlob('a/b/rule.draft.yaml', ['*.draft.yaml']), true);
        assert.strictEqual(matchesAnyGlob('a/b/rule.yaml', ['*.draft.yaml']), false);
    });

    test('matches template files anywhere in the tree', () => {
        assert.strictEqual(matchesAnyGlob('templates/standard-rule.template.yaml', ['**/*.template.yaml']), true);
    });

    test('single-star does not cross path separators', () => {
        assert.strictEqual(matchesAnyGlob('a/b/c.yaml', ['a/*.yaml']), false);
        assert.strictEqual(matchesAnyGlob('a/c.yaml', ['a/*.yaml']), true);
    });

    test('question mark matches exactly one character', () => {
        assert.strictEqual(matchesAnyGlob('rule1.yaml', ['rule?.yaml']), true);
        assert.strictEqual(matchesAnyGlob('rule12.yaml', ['rule?.yaml']), false);
    });

    test('brace alternation matches any listed option', () => {
        assert.strictEqual(matchesAnyGlob('a.yaml', ['**/*.{yaml,yml}']), true);
        assert.strictEqual(matchesAnyGlob('a.yml', ['**/*.{yaml,yml}']), true);
        assert.strictEqual(matchesAnyGlob('a.json', ['**/*.{yaml,yml}']), false);
    });

    test('wildcards on both sides match a substring in a segment', () => {
        assert.strictEqual(matchesAnyGlob('Content/mytest-rule.yaml', ['**/*test*']), true);
    });

    test('an empty pattern list never matches', () => {
        assert.strictEqual(matchesAnyGlob('anything.yaml', []), false);
    });

    test('case sensitivity is configurable', () => {
        assert.strictEqual(matchesAnyGlob('A/Test/x.yaml', ['**/test/**'], true), false);
        assert.strictEqual(matchesAnyGlob('A/Test/x.yaml', ['**/test/**'], false), true);
    });

    test('invalid or empty entries are ignored without throwing', () => {
        assert.strictEqual(matchesAnyGlob('a.yaml', ['', undefined as unknown as string, 'a.yaml']), true);
    });

    test('globToRegExp anchors the whole string', () => {
        const re = globToRegExp('*.yaml');
        assert.strictEqual(re.test('rule.yaml'), true);
        assert.strictEqual(re.test('rule.yaml.bak'), false);
    });
});
