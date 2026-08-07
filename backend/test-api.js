/**
 * Test script for FieldServicer API integration
 * Run with: node test-api.js
 */

import { fieldServicerClient } from './src/config/fieldservicer.js'
import { logger } from './src/utils/logger.js'

async function testFieldServicerAPI() {
  try {
    console.log('\n=== Testing FieldServicer API Integration ===\n')

    // Test 1: Login
    console.log('1. Testing Login...')
    const authData = await fieldServicerClient.login()
    console.log('✓ Login successful')
    console.log(`   Access Token: ${authData.AccessToken?.substring(0, 20)}...`)
    console.log(`   Refresh Token: ${authData.RefreshToken ? 'Present' : 'Not present'}`)

    // Test 2: Get Roster Shifts
    console.log('\n2. Testing Roster Shift List...')
    const shifts = await fieldServicerClient.getRosterShiftList({
      locationId: 0,
      clientId: 0,
      fromDate: '2026-08-01',
      toDate: '2026-08-31',
    })
    console.log(`✓ Fetched ${shifts?.length || 0} shifts`)
    
    if (shifts && shifts.length > 0) {
      console.log('\nSample shift data:')
      console.log(JSON.stringify(shifts[0], null, 2))
    }

    console.log('\n=== All Tests Passed ===\n')
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
    }
    process.exit(1)
  }
}

testFieldServicerAPI()
