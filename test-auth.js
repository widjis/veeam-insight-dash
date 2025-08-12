import axios from 'axios';

async function testAuth() {
  try {
    console.log('Testing authentication...');
    
    // Test login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('Login successful!');
    console.log('Access Token:', loginResponse.data.data.accessToken.substring(0, 50) + '...');
    
    const token = loginResponse.data.data.accessToken;
    
    // Test dashboard stats with token
    const statsResponse = await axios.get('http://localhost:3001/api/dashboard/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Dashboard stats retrieved successfully!');
    console.log('Stats:', JSON.stringify(statsResponse.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAuth();