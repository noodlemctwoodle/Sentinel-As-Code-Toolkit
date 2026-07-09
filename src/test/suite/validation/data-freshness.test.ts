import * as assert from 'assert';
import { loadDataFile } from './test-utils';

suite('Data Freshness Tests', () => {
    test('should have valid connector data with expected metadata', () => {
        const connectorData = loadDataFile('connectors.json');

        // Check metadata exists and carries a generation date.
        assert.ok(connectorData.metadata, 'Connector data should have metadata');
        assert.ok(connectorData.metadata.generatedDate, 'Should have generation date');

        // Freshness of the committed data is enforced by the scheduled refresh-connectors
        // workflow, not this deterministic suite. Assert only that the recorded date is
        // valid and not in the future so the test stays time-independent.
        const generatedDate = new Date(connectorData.metadata.generatedDate);
        assert.ok(!Number.isNaN(generatedDate.getTime()),
            `Generation date should be a valid date (${connectorData.metadata.generatedDate})`
        );
        assert.ok(generatedDate.getTime() <= Date.now(),
            `Generation date should not be in the future (${connectorData.metadata.generatedDate})`
        );

        // Check connector count is reasonable
        assert.ok(connectorData.metadata.totalConnectors >= 300, 
            'Should have at least 300 connectors'
        );
    });

    test('should have comprehensive MITRE data coverage', () => {
        const enterpriseData = loadDataFile('mitre-v16.json');
        
        // Should have comprehensive technique coverage
        const techniques = enterpriseData.objects.filter((obj: any) => obj.type === 'attack-pattern');
        const tactics = enterpriseData.objects.filter((obj: any) => obj.type === 'x-mitre-tactic');
        
        assert.ok(techniques.length >= 500, `Should have many techniques (found ${techniques.length})`);
        assert.ok(tactics.length >= 10, `Should have multiple tactics (found ${tactics.length})`);
        
        // Check for well-known tactics
        const tacticNames = tactics.map((t: any) => t.name);
        const expectedTactics = ['Initial Access', 'Execution', 'Persistence', 'Defense Evasion'];
        
        expectedTactics.forEach(expectedTactic => {
            assert.ok(tacticNames.includes(expectedTactic), 
                `Should include expected tactic: ${expectedTactic}`
            );
        });
    });

    test('should have reasonable data loading performance', () => {
        const start = Date.now();
        
        // Load all data files
        const connectorData = loadDataFile('connectors.json');
        const enterpriseData = loadDataFile('mitre-v16.json');
        const _mobileData = loadDataFile('mitre-mobile.json');  // Prefixed with underscore to indicate intentionally unused
        const _icsData = loadDataFile('mitre-ics.json');        // Prefixed with underscore to indicate intentionally unused
        
        const loadTime = Date.now() - start;
        
        // Should load data reasonably quickly (adjust threshold as needed)
        assert.ok(loadTime < 2000, `Data loading took ${loadTime}ms, should be under 2000ms`);
        
        // Verify we actually loaded substantial data
        assert.ok(connectorData.tablesByConnector.length > 100, 'Should load many connectors');
        assert.ok(enterpriseData.objects.length > 1000, 'Should load many MITRE objects');
    });
});