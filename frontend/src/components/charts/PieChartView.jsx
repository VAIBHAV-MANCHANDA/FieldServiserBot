import DynamicChart from './DynamicChart.jsx'

export default function PieChartView(props) {
  return <DynamicChart chart={{ ...props, type: 'pie' }} />
}
