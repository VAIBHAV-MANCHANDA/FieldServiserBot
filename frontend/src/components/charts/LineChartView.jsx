import DynamicChart from './DynamicChart.jsx'

export default function LineChartView(props) {
  return <DynamicChart chart={{ ...props, type: 'line' }} />
}
