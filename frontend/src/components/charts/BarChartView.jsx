import DynamicChart from './DynamicChart.jsx'

export default function BarChartView(props) {
  return <DynamicChart chart={{ ...props, type: 'bar' }} />
}
