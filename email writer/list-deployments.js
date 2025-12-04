import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
const key = process.env.AZURE_OPENAI_API_KEY;

console.log('Testing Azure Deployment List');
console.log('=============================');
console.log('Endpoint:', endpoint);
console.log('');

async function listDeployments() {
  try {
    // Try listing deployments via REST API
    const url = `${endpoint}/deployments?api-version=2024-06-01`;
    console.log('URL:', url);
    console.log('');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'api-key': key,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response Status:', response.status);
    const responseText = await response.text();
    console.log('Response Body:', responseText);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('\n✓ Available Deployments:');
        if (data.data && Array.isArray(data.data)) {
          data.data.forEach(dep => {
            console.log(`  - ${dep.id} (status: ${dep.status}, created: ${dep.created_at})`);
          });
        } else {
          console.log(JSON.stringify(data, null, 2));
        }
      } catch {
        console.log('Could not parse JSON, raw response above.');
      }
    }
  } catch (err) {
    console.error('✗ ERROR:', err.message);
  }
}

listDeployments();
