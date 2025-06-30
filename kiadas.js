import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { Plus, DollarSign, Edit, Trash2, X, BarChart2, TrendingUp, HandCoins, History, LineChart as LineChartIcon, TrendingUp as TrendingUpIcon, Wallet, ReceiptText, CalendarCheck, LayoutDashboard, FileText, PiggyBank } from 'lucide-react'; // Added LayoutDashboard for dashboard icon
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Ensure d3 is loaded globally for MiniAssetChart
// This is typically done via a <script> tag in index.html, e.g.:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>

// Helper function for custom modals
const Modal = ({ children, onClose, title }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">{title}</h2>
        {children}
      </div>
    </div>
  );
};

// Component to display Net Worth History Chart
function NetWorthHistoryChart({ assets, loading }) {
  const [selectedDateBreakdown, setSelectedDateBreakdown] = useState(null);

  // Function to aggregate asset histories into a single total net worth history
  // and also provide detailed daily values for breakdown.
  const calculateNetWorthHistory = (assets) => {
    const dailyValuesMap = new Map(); // Map: 'YYYY-MM-DD' -> Map: assetId -> value

    // First pass: Populate all known asset values per day
    assets.forEach(asset => {
      const sortedValueHistory = [...(asset.valueHistory || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
      sortedValueHistory.forEach(entry => {
        const date = entry.date;
        if (!dailyValuesMap.has(date)) {
          dailyValuesMap.set(date, new Map());
        }
        dailyValuesMap.get(date).set(asset.id, entry.value);
      });
    });

    // Get all unique dates and sort them
    const uniqueDates = Array.from(dailyValuesMap.keys()).sort((a, b) => new Date(a) - new Date(b));

    const aggregatedHistory = [];
    const currentAssetValuesAtDate = new Map(); // Map: assetId -> value (tracks current value for iteration)

    uniqueDates.forEach(date => {
      let totalNetWorthOnDate = 0;

      // Update currentAssetValuesAtDate for this specific 'date'
      // This correctly propagates the last known value forward for each asset
      assets.forEach(asset => {
        const valueForThisAssetOnThisDate = dailyValuesMap.get(date)?.get(asset.id);
        if (valueForThisAssetOnThisDate !== undefined) {
          currentAssetValuesAtDate.set(asset.id, valueForThisAssetOnThisDate);
        }
      });

      // Sum up total net worth from currentAssetValuesAtDate
      currentAssetValuesAtDate.forEach(value => {
        totalNetWorthOnDate += value;
      });

      aggregatedHistory.push({
        date: date,
        totalNetWorth: parseFloat(totalNetWorthOnDate.toFixed(2))
      });
    });

    // Convert dailyValuesMap (Map of Maps) to a more easily consumable Map of Objects
    const detailedDailyValues = new Map();
    dailyValuesMap.forEach((innerMap, date) => {
      const obj = {};
      innerMap.forEach((value, key) => {
        obj[key] = value;
      });
      detailedDailyValues.set(date, obj);
    });

    return { chartData: aggregatedHistory, detailedDailyValues };
  };

  const { chartData, detailedDailyValues } = useMemo(() => calculateNetWorthHistory(assets), [assets]);

  // Function to handle mouse movement on the chart to update breakdown
  const handleMouseMove = (state) => {
    if (state.activePayload && state.activePayload.length > 0) {
      const dataPoint = state.activePayload[0].payload;
      const hoveredDate = dataPoint.date;
      const valuesForHoveredDate = detailedDailyValues.get(hoveredDate) || {};

      const breakdown = Object.entries(valuesForHoveredDate)
        .map(([assetId, value]) => {
          const assetInfo = assets.find(a => a.id === assetId);
          // Only include assets that existed or had a recorded value up to this point
          // and ensure 'name' is available
          return assetInfo ? { id: assetId, name: assetInfo.name, value: value, type: assetInfo.type } : null;
        })
        .filter(Boolean); // Filter out any null entries if assetInfo was not found

      setSelectedDateBreakdown({ date: hoveredDate, assets: breakdown });
    } else {
      setSelectedDateBreakdown(null); // Clear breakdown when mouse is not on a data point
    }
  };

  const handleMouseLeave = () => {
    setSelectedDateBreakdown(null); // Clear breakdown when mouse leaves the chart area
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg text-center text-gray-600 min-h-[300px] flex items-center justify-center">
        Loading net worth history...
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg text-center text-gray-600 min-h-[300px] flex items-center justify-center">
        Add assets and update their values to see your net worth history!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <History size={28} className="mr-2 text-indigo-500" /> Net Worth History
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            onMouseMove={handleMouseMove} // Handle mouse movement for breakdown
            onMouseLeave={handleMouseLeave} // Clear breakdown on mouse leave
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="date" minTickGap={20} />
            <YAxis
              tickFormatter={(value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            />
            <Tooltip
              formatter={(value) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Net Worth']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalNetWorth"
              stroke="#8884d8"
              activeDot={{ r: 8 }}
              strokeWidth={2}
              name="Total Net Worth"
            />
          </LineChart>
        </ResponsiveContainer>
        {chartData.length <= 1 && (
          <p className="text-center text-gray-500 mt-4">
            Add more asset updates or contributions to see a richer history chart.
          </p>
        )}
      </div>

      {selectedDateBreakdown && (
        <div className="bg-white p-6 rounded-xl shadow-lg w-full">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            Asset Breakdown for {selectedDateBreakdown.date}
          </h3>
          {selectedDateBreakdown.assets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-lg">
                      Asset Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-lg">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedDateBreakdown.assets
                    .sort((a, b) => b.value - a.value) // Sort by value descending
                    .map(asset => (
                    <tr key={asset.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {asset.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {asset.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        €{asset.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500">No asset data available for this date.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Component to display individual asset history details
function AssetHistoryDetailsModal({ asset }) {
  // Sort history by date ascending
  const sortedHistory = [...(asset.valueHistory || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-700">Historical Values</h4>
      {sortedHistory.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedHistory.map((entry, index) => {
                const previousValue = index > 0 ? sortedHistory[index - 1].value : 0;
                const change = entry.value - previousValue;
                const changeColor = change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500';
                const changeIcon = change > 0 ? '▲' : change < 0 ? '▼' : '';

                return (
                  <tr key={index}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{entry.date}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                      €{entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${changeColor}`}>
                      {index > 0 ? `${changeIcon} €${change.toLocaleString('en-US', { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                      {entry.type === 'contribution' ? 'Contribution' : (index === 0 ? 'Initial Value' : 'Value Update')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-500">No historical data available for this asset.</p>
      )}
    </div>
  );
}

// MiniAssetChart Component (Revised for D3 error)
function MiniAssetChart({ data, width = 120, height = 40 }) {
  const svgRef = useRef();

  useEffect(() => {
    // Only proceed if d3 is available
    if (typeof window.d3 === 'undefined') {
      console.warn("D3 library (window.d3) is not available. MiniAssetChart cannot render.");
      // If d3 is not available, ensure the SVG is empty
      if (svgRef.current) {
        svgRef.current.innerHTML = ''; // Clear existing content gracefully
      }
      return; // Exit early
    }

    const d3 = window.d3; // Use the globally available d3

    // Now that we've confirmed d3 exists, proceed with other checks
    if (!data || data.length < 2) {
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll("*").remove(); // Safely clear using d3 if it exists
      }
      return; // Exit early if data is insufficient
    }

    // Sort data by date
    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Filter out duplicate dates, keeping the last value for each date
    const uniqueDatesDataMap = new Map();
    sortedData.forEach(d => uniqueDatesDataMap.set(d.date, d));
    const uniqueSortedData = Array.from(uniqueDatesDataMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (uniqueSortedData.length < 2) {
        if (svgRef.current) {
            d3.select(svgRef.current).selectAll("*").remove(); // Safely clear using d3
        }
        return;
    }

    const margin = { top: 5, right: 5, bottom: 5, left: 5 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Clear previous chart elements
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleTime()
      .domain(d3.extent(uniqueSortedData, d => new Date(d.date)))
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(uniqueSortedData, d => d.value))
      .range([chartHeight, 0]);

    const line = d3.line()
      .x(d => xScale(new Date(d.date)))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX); // Smooth the line

    // Draw the line path
    g.append("path")
      .datum(uniqueSortedData)
      .attr("fill", "none")
      .attr("stroke", "#8884d8") // Purple color
      .attr("stroke-width", 1.5)
      .attr("d", line);

    // Add circles for each data point
    g.selectAll(".dot")
      .data(uniqueSortedData)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", d => xScale(new Date(d.date)))
      .attr("cy", d => yScale(d.value))
      .attr("r", 2) // Radius of the circle
      .attr("fill", "#8884d8");

  }, [data, width, height]);

  return <svg ref={svgRef}></svg>;
}

// Component for Net Worth Projections
function NetWorthProjectionChart({ currentNetWorth, loading }) {
  const [annualGrowthRate, setAnnualGrowthRate] = useState(5); // Default 5%
  const [monthlyContribution, setMonthlyContribution] = useState(100); // Default 100 EUR
  const [projectionPeriodYears, setProjectionPeriodYears] = useState(10); // Default 10 years

  const projectionData = useMemo(() => {
    if (loading || currentNetWorth === undefined || currentNetWorth === null) {
      return [];
    }

    const data = [];
    let projectedValue = currentNetWorth;
    const monthlyGrowthRate = annualGrowthRate / 100 / 12; // Convert % to decimal, then to monthly

    // Start with current year's data point
    const currentYear = new Date().getFullYear();
    data.push({ year: currentYear, projectedNetWorth: parseFloat(currentNetWorth.toFixed(2)) });

    for (let year = 1; year <= projectionPeriodYears; year++) {
      for (let month = 0; month < 12; month++) {
        projectedValue += monthlyContribution;
        projectedValue *= (1 + monthlyGrowthRate);
      }
      data.push({ year: currentYear + year, projectedNetWorth: parseFloat(projectedValue.toFixed(2)) });
    }
    return data;
  }, [currentNetWorth, annualGrowthRate, monthlyContribution, projectionPeriodYears, loading]);

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg text-center text-gray-600 min-h-[300px] flex items-center justify-center">
        Loading projection data...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <TrendingUpIcon size={28} className="mr-2 text-green-500" /> Net Worth Projections
        </h2>

        {/* Projection Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label htmlFor="annualGrowthRate" className="block text-sm font-medium text-gray-700">Annual Growth Rate (%)</label>
            <input
              type="number"
              id="annualGrowthRate"
              value={annualGrowthRate}
              onChange={(e) => setAnnualGrowthRate(parseFloat(e.target.value))}
              min="0"
              step="0.1"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="monthlyContribution" className="block text-sm font-medium text-gray-700">Monthly Contribution (EUR)</label>
            <input
              type="number"
              id="monthlyContribution"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(parseFloat(e.target.value))}
              min="0"
              step="1"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="projectionPeriod" className="block text-sm font-medium text-gray-700">Projection Period (Years)</label>
            <input
              type="number"
              id="projectionPeriod"
              value={projectionPeriodYears}
              onChange={(e) => setProjectionPeriodYears(parseInt(e.target.value))}
              min="1"
              max="50"
              step="1"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Projection Chart */}
        {projectionData.length > 1 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={projectionData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="year" tickFormatter={(value) => value.toString()} />
              <YAxis
                tickFormatter={(value) => `€${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              />
              <Tooltip
                formatter={(value) => [`€${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Projected Net Worth']}
                labelFormatter={(label) => `Year: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="projectedNetWorth"
                stroke="#4CAF50" // Green color for projections
                activeDot={{ r: 8 }}
                strokeWidth={2}
                name="Projected Net Worth"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-500 mt-4">
            Adjust the projection inputs to see your future net worth!
          </p>
        )}
      </div>
    </div>
  );
}

// Generic Component to display transaction history details (for both income and expense)
function TransactionHistoryDetailsModal({ transaction }) {
  // Sort history by timestamp ascending
  const sortedHistory = [...(transaction.history || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-700">Transaction History for "{transaction.description}"</h4>
      {sortedHistory.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                {transaction.category && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>}
                {/* Always show type column for consistency */}
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Occurrence Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recurring Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedHistory.map((entry, index) => (
                <tr key={index}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{new Date(entry.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{entry.changeType}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    €{entry.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{entry.description}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{entry.date}</td>
                  {transaction.category && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{entry.category || 'N/A'}</td>}
                  {/* Display 'One-Off' or 'Recurring' based on isRecurring flag */}
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                    {entry.isRecurring ? 'Recurring' : 'One-Off'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                    {entry.isRecurring ? `Frequency: ${entry.frequency || 'N/A'}${entry.endDate ? `, until ${entry.endDate}` : ', No End Date'}` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-500">No historical data available for this transaction.</p>
      )}
    </div>
  );
}


// Income/Expenses Page Component
function IncomeExpensesPage({ income, expenses, addIncome, addExpense, updateIncome, updateExpense, deleteIncome, deleteExpense, loading,
  setShowEditIncomeModal, setSelectedIncomeForEdit, setShowIncomeDetailsModal, setSelectedIncomeForDetails,
  setShowIncomeDeleteConfirmModal, setIncomeToDelete, setShowEditExpenseModal, setSelectedExpenseForEdit,
  setShowExpenseDetailsModal, setSelectedExpenseForDetails, setShowExpenseDeleteConfirmModal, setExpenseToDelete
}) {
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  const sortedIncome = useMemo(() => {
    return [...income].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [income]);

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses]);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <Wallet size={28} className="mr-2 text-teal-500" /> Income & Expenses
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Income Section */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Income</h3>
              <button
                onClick={() => setShowAddIncomeModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-full shadow-md flex items-center transition duration-300"
              >
                <Plus size={20} className="mr-2" /> Add Income
              </button>
            </div>
            {sortedIncome.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No income recorded yet.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {sortedIncome.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm mb-2 last:mb-0 border border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">{item.description}</p>
                      <p className="text-sm text-gray-500">{item.date} {item.isRecurring ? `(Recurring ${item.frequency || ''}${item.endDate ? ` until ${item.endDate}` : ''})` : ''}</p>
                    </div>
                    <div className="flex gap-2">
                        <p className="text-green-600 font-semibold">€{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <button
                          onClick={() => { setSelectedIncomeForEdit(item); setShowEditIncomeModal(true); }}
                          className="text-blue-500 hover:text-blue-700"
                          title="Edit Income"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => { setSelectedIncomeForDetails(item); setShowIncomeDetailsModal(true); }}
                          className="text-purple-500 hover:text-purple-700"
                          title="View History"
                        >
                          <FileText size={18} />
                        </button>
                        <button
                          onClick={() => { setIncomeToDelete(item); setShowIncomeDeleteConfirmModal(true); }}
                          className="text-red-500 hover:text-red-700"
                          title="Delete Income"
                        >
                          <Trash2 size={18} />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense Section */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Expenses</h3>
              <button
                onClick={() => setShowAddExpenseModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-full shadow-md flex items-center transition duration-300"
              >
                <Plus size={20} className="mr-2" /> Add Expense
              </button>
            </div>
            {sortedExpenses.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No expenses recorded yet.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {sortedExpenses.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm mb-2 last:mb-0 border border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">{item.description}</p>
                      <p className="text-sm text-gray-500">
                        {item.date} • {item.category} • {item.isRecurring ? `(Recurring ${item.frequency || ''}${item.endDate ? ` until ${item.endDate}` : ''})` : '(One-Off)'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                        <p className="text-red-600 font-semibold">-€{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <button
                          onClick={() => { setSelectedExpenseForEdit(item); setShowEditExpenseModal(true); }}
                          className="text-blue-500 hover:text-blue-700"
                          title="Edit Expense"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => { setSelectedExpenseForDetails(item); setShowExpenseDetailsModal(true); }}
                          className="text-purple-500 hover:text-purple-700"
                          title="View History"
                        >
                          <FileText size={18} />
                        </button>
                        <button
                          onClick={() => { setExpenseToDelete(item); setShowExpenseDeleteConfirmModal(true); }}
                          className="text-red-500 hover:text-red-700"
                          title="Delete Expense"
                        >
                          <Trash2 size={18} />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddIncomeModal && (
        <Modal title="Add New Income" onClose={() => setShowAddIncomeModal(false)}>
          <AddIncomeForm onAdd={addIncome} onClose={() => setShowAddIncomeModal(false)} />
        </Modal>
      )}

      {showAddExpenseModal && (
        <Modal title="Add New Expense" onClose={() => setShowAddExpenseModal(false)}>
          <AddExpenseForm onAdd={addExpense} onClose={() => setShowAddExpenseModal(false)} />
        </Modal>
      )}
    </div>
  );
}

// Monthly Overview Page Component
function MonthlyOverviewPage({ income, expenses, loading }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // JS months are 0-indexed
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    { value: 1, name: 'January' }, { value: 2, name: 'February' }, { value: 3, name: 'March' },
    { value: 4, name: 'April' }, { value: 5, name: 'May' }, { value: 6, name: 'June' },
    { value: 7, name: 'July' }, { value: 8, name: 'August' }, { value: 9, name: 'September' },
    { value: 10, name: 'October' }, { value: 11, name: 'November' }, { value: 12, name: 'December' },
  ];

  const availableYears = useMemo(() => {
    const years = new Set();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    years.add(currentYear - 1); // Include previous year
    years.add(currentYear + 1); // Include next year

    income.forEach(item => years.add(new Date(item.date).getFullYear()));
    expenses.forEach(item => years.add(new Date(item.date).getFullYear()));
    
    // Add years from recurring end dates if applicable
    income.filter(i => i.isRecurring && i.endDate).forEach(i => years.add(new Date(i.endDate).getFullYear()));
    expenses.filter(e => e.isRecurring && e.endDate).forEach(e => years.add(new Date(e.endDate).getFullYear()));


    return Array.from(years).sort((a, b) => b - a); // Sort descending
  }, [income, expenses]);

  // Helper function to check if a recurring item is active in the selected month
  const isTransactionActiveInMonth = (transaction, selectedMonthDate) => {
    const startDate = new Date(transaction.date);
    const endDate = transaction.endDate ? new Date(transaction.endDate) : null;

    // Check if the transaction starts before or in the selected month
    const startsBeforeOrInSelectedMonth = startDate.getFullYear() < selectedMonthDate.getFullYear() ||
                                         (startDate.getFullYear() === selectedMonthDate.getFullYear() && startDate.getMonth() <= selectedMonthDate.getMonth());

    // Check if the transaction ends after or in the selected month (or has no end date)
    const endsAfterOrInSelectedMonth = !endDate || endDate.getFullYear() > selectedMonthDate.getFullYear() ||
                                      (endDate.getFullYear() === selectedMonthDate.getFullYear() && endDate.getMonth() >= selectedMonthDate.getMonth());

    return startsBeforeOrInSelectedMonth && endsAfterOrInSelectedMonth;
  };

  const filteredIncome = useMemo(() => {
    const selectedMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    return income.filter(item => {
      if (item.isRecurring && item.frequency === 'Monthly') {
        return isTransactionActiveInMonth(item, selectedMonthDate);
      } else {
        // For one-off items, check if the item's date is in the exact selected month
        const itemDate = new Date(item.date);
        return itemDate.getFullYear() === selectedMonthDate.getFullYear() &&
               itemDate.getMonth() === selectedMonthDate.getMonth();
      }
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [income, selectedMonth, selectedYear]);

  const filteredExpenses = useMemo(() => {
    const selectedMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    return expenses.filter(item => {
      if (item.isRecurring && item.frequency === 'Monthly') {
        return isTransactionActiveInMonth(item, selectedMonthDate);
      } else {
        // For one-off items, check if the item's date is in the exact selected month
        const itemDate = new Date(item.date);
        return itemDate.getFullYear() === selectedMonthDate.getFullYear() &&
               itemDate.getMonth() === selectedMonthDate.getMonth();
      }
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, selectedMonth, selectedYear]);

  const totalMonthlyIncome = filteredIncome.reduce((sum, item) => sum + item.amount, 0);
  const totalMonthlyExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const monthlyBalance = totalMonthlyIncome - totalMonthlyExpenses;

  const expenseSummaryByCategory = useMemo(() => {
    const summary = {};
    filteredExpenses.forEach(exp => {
      summary[exp.category] = (summary[exp.category] || 0) + exp.amount;
    });
    return Object.entries(summary).sort(([, a], [, b]) => b - a); // Sort by amount descending
  }, [filteredExpenses]);

  const expenseSummaryByType = useMemo(() => {
    const summary = {};
    filteredExpenses.forEach(exp => {
      summary[exp.type] = (summary[exp.type] || 0) + exp.amount;
    });
    return Object.entries(summary).sort(([, a], [, b]) => b - a); // Sort by amount descending
  }, [filteredExpenses]);


  if (loading) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg text-center text-gray-600 min-h-[300px] flex items-center justify-center">
        Loading monthly overview...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <CalendarCheck size={28} className="mr-2 text-purple-500" /> Monthly Overview
        </h2>

        {/* Month/Year Selector */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center justify-center">
          <div className="w-full sm:w-auto">
            <label htmlFor="monthSelect" className="sr-only">Select Month</label>
            <select
              id="monthSelect"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label htmlFor="yearSelect" className="sr-only">Select Year</label>
            <select
              id="yearSelect"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-center">
          <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
            <p className="text-sm font-medium text-green-700">Total Income</p>
            <p className="text-2xl font-bold text-green-800">€{totalMonthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200">
            <p className="text-sm font-medium text-red-700">Total Expenses</p>
            <p className="text-2xl font-bold text-red-800">€{totalMonthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className={`p-4 rounded-lg shadow-sm border ${monthlyBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className="text-sm font-medium text-gray-700">Monthly Balance</p>
            <p className={`text-2xl font-bold ${monthlyBalance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
              €{monthlyBalance.toLocaleString('en-US', { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Detailed Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Income List */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Income Details</h3>
            {filteredIncome.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No income for this month.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {filteredIncome.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm mb-2 last:mb-0 border border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">{item.description}</p>
                      <p className="text-sm text-gray-500">{item.date} {item.isRecurring ? `(Recurring ${item.frequency || ''}${item.endDate ? ` until ${item.endDate}` : ''})` : ''}</p>
                    </div>
                    <p className="text-green-600 font-semibold">€{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense List */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Expense Details</h3>
            {filteredExpenses.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No expenses for this month.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {filteredExpenses.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm mb-2 last:mb-0 border border-gray-100">
                    <div>
                      <p className="font-medium text-gray-900">{item.description}</p>
                      <p className="text-sm text-gray-500">
                        {item.date} • {item.category} • {item.isRecurring ? `(Recurring ${item.frequency || ''}${item.endDate ? ` until ${item.endDate}` : ''})` : '(One-Off)'}
                      </p>
                    </div>
                    <p className="text-red-600 font-semibold">-€{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>
            )}

            <h4 className="text-lg font-semibold text-gray-700 mt-6 mb-3">Expenses by Category</h4>
            {expenseSummaryByCategory.length > 0 ? (
              <ul className="space-y-1 text-sm text-gray-700">
                {expenseSummaryByCategory.map(([category, amount]) => (
                  <li key={category} className="flex justify-between">
                    <span>{category}:</span>
                    <span className="font-medium">€{amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No categorized expenses.</p>
            )}

            <h4 className="text-lg font-semibold text-gray-700 mt-6 mb-3">Expenses by Type</h4>
            {expenseSummaryByType.length > 0 ? (
              <ul className="space-y-1 text-sm text-gray-700">
                {expenseSummaryByType.map(([type, amount]) => (
                  <li key={type} className="flex justify-between">
                    <span>{type}:</span>
                    <span className="font-medium">€{amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No expenses by type.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// New Assets Page component to wrap the assets list
function AssetsPage({ assets, loading, totalNetWorthEUR, totalNetWorthUSD, totalNetWorthGBP, totalNetWorthHUF,
  setShowAddAssetModal, setShowUpdateModal, setSelectedAssetForUpdate, setShowContributionModal, setSelectedAssetForContribution,
  setShowDeleteConfirmModal, setAssetToDelete, setShowAssetDetailsModal, setSelectedAssetForDetails,
  addAsset, updateAssetValue, addContribution, deleteAsset // Pass these functions down
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Net Worth Summary - Now at the top, full width */}
      <div className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white p-8 rounded-xl shadow-lg flex flex-col items-center justify-center w-full">
        <h2 className="text-3xl font-bold mb-3 flex items-center">
          <DollarSign size={32} className="mr-2" /> Total Net Worth (EUR)
        </h2>
        <p className="text-6xl font-extrabold tracking-tight mb-4">
          €{totalNetWorthEUR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className="text-xl font-semibold grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-6 text-center w-full">
          <p>USD: ${totalNetWorthUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p>GBP: £{totalNetWorthGBP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p>HUF: Ft{totalNetWorthHUF.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Assets List - Now below, full width */}
      <div className="bg-white p-6 rounded-xl shadow-lg w-full">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <TrendingUp size={28} className="mr-2 text-indigo-500" /> Your Assets
          </h2>
          <button
            onClick={() => setShowAddAssetModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-full shadow-md flex items-center transition duration-300 ease-in-out transform hover:scale-105"
          >
            <Plus size={20} className="mr-2" /> Add New Asset
          </button>
        </div>

        {assets.length === 0 && !loading && (
          <p className="text-center text-gray-500 py-8">No assets added yet. Click "Add New Asset" to get started!</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {assets.map(asset => {
            const totalContributions = asset.contributions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
            const interestMovement = (asset.currentValue || 0) - (asset.initialValue || 0) - totalContributions;
            const interestMovementColor = interestMovement > 0 ? 'text-green-600' : interestMovement < 0 ? 'text-red-600' : 'text-gray-500';
            return (
              <div key={asset.id} className="bg-gray-50 border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-indigo-700">{asset.name}</h3>
                  <p className="text-sm text-gray-600 mb-3"><span className="font-medium">Type:</span> {asset.type}</p>
                  <div className="flex justify-between items-end mb-3">
                      <p className="text-lg font-bold text-gray-900">
                          Current Value: €{asset.currentValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {/* Mini Chart */}
                      <div className="ml-4">
                          <MiniAssetChart data={asset.valueHistory} width={120} height={40} />
                      </div>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Initial Value: €{asset.initialValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p>Contributions: €{totalContributions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className={`font-semibold ${interestMovementColor}`}>
                      Interest Movement: €{interestMovement.toLocaleString('en-US', { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    onClick={() => { setSelectedAssetForUpdate(asset); setShowUpdateModal(true); }}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2 px-3 rounded-md shadow-sm flex items-center justify-center transition duration-200"
                  >
                    <Edit size={18} className="mr-2" /> Update Value
                  </button>
                  <button
                    onClick={() => { setSelectedAssetForContribution(asset); setShowContributionModal(true); }}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 px-3 rounded-md shadow-sm flex items-center justify-center transition duration-200"
                  >
                    <HandCoins size={18} className="mr-2" /> Add Contribution
                  </button>
                  <button
                    onClick={() => { setSelectedAssetForDetails(asset); setShowAssetDetailsModal(true); }} // New button to view asset details
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold py-2 px-3 rounded-md shadow-sm flex items-center justify-center transition duration-200"
                  >
                    <History size={18} className="mr-2" /> View Details
                  </button>
                  <button
                    onClick={() => { setAssetToDelete(asset); setShowDeleteConfirmModal(true); }}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 px-3 rounded-md shadow-sm flex items-center justify-center transition duration-200"
                  >
                    <Trash2 size={18} className="mr-2" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Dashboard Page Component
function DashboardPage({ assets, income, expenses, loading, totalNetWorthEUR }) {
    // Calculate current month's income and expenses
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Helper function to check if a recurring item is active in the current month
    const isTransactionActiveInCurrentMonth = (transaction) => {
      const startDate = new Date(transaction.date);
      const endDate = transaction.endDate ? new Date(transaction.endDate) : null;

      // Check if the transaction starts before or in the current month
      const startsBeforeOrInCurrentMonth = startDate.getFullYear() < currentYear ||
                                           (startDate.getFullYear() === currentYear && startDate.getMonth() <= currentMonth);

      // Check if the transaction ends after or in the current month (or has no end date)
      const endsAfterOrInCurrentMonth = !endDate || endDate.getFullYear() > currentYear ||
                                        (endDate.getFullYear() === currentYear && endDate.getMonth() >= currentMonth);

      return startsBeforeOrInCurrentMonth && endsAfterOrInCurrentMonth;
    };

    const currentMonthIncome = useMemo(() => {
        return income.filter(item => {
            if (item.isRecurring && item.frequency === 'Monthly') {
                return isTransactionActiveInCurrentMonth(item);
            } else {
                const itemDate = new Date(item.date);
                return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
            }
        }).reduce((sum, item) => sum + item.amount, 0);
    }, [income, currentMonth, currentYear]);

    const currentMonthExpenses = useMemo(() => {
        return expenses.filter(item => {
            if (item.isRecurring && item.frequency === 'Monthly') {
                return isTransactionActiveInCurrentMonth(item);
            } else {
                const itemDate = new Date(item.date);
                return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
            }
        }).reduce((sum, item) => sum + item.amount, 0);
    }, [expenses, currentMonth, currentYear]);

    const currentMonthBalance = currentMonthIncome - currentMonthExpenses;

    const expenseCategoriesData = useMemo(() => {
      const summary = {};
      expenses.filter(item => { // Filter expenses only for the current month/year
        if (item.isRecurring && item.frequency === 'Monthly') {
          return isTransactionActiveInCurrentMonth(item);
        } else {
          const itemDate = new Date(item.date);
          return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
        }
      }).forEach(exp => {
        summary[exp.category] = (summary[exp.category] || 0) + exp.amount;
      });
      return Object.entries(summary).map(([name, value]) => ({ name, value }));
    }, [expenses, currentMonth, currentYear]);

    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#FF8042', '#0088FE', '#00C49F', '#FFBB28']; // More colors if needed

    if (loading) {
      return (
        <div className="bg-white p-8 rounded-xl shadow-lg text-center text-gray-600 min-h-[300px] flex items-center justify-center">
          Loading dashboard data...
        </div>
      );
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                    <LayoutDashboard size={28} className="mr-2 text-blue-600" /> Dashboard
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-center">
                    <div className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white p-4 rounded-lg shadow-md flex flex-col justify-center items-center">
                        <p className="text-sm font-medium opacity-90">Total Net Worth</p>
                        <p className="text-3xl font-extrabold mt-1">
                            €{totalNetWorthEUR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200 flex flex-col justify-center items-center">
                        <p className="text-sm font-medium text-green-700">Monthly Income</p>
                        <p className="text-2xl font-bold text-green-800 mt-1">
                            €{currentMonthIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200 flex flex-col justify-center items-center">
                        <p className="text-sm font-medium text-red-700">Monthly Expenses</p>
                        <p className="text-2xl font-bold text-red-800 mt-1">
                            €{currentMonthExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className={`p-4 rounded-lg shadow-sm border col-span-1 md:col-span-3 ${currentMonthBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} flex flex-col justify-center items-center`}>
                        <p className="text-sm font-medium text-gray-700">Monthly Balance</p>
                        <p className={`text-3xl font-bold ${currentMonthBalance >= 0 ? 'text-blue-800' : 'text-orange-800'} mt-1`}>
                            €{currentMonthBalance.toLocaleString('en-US', { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Monthly Expense by Category Chart */}
                    <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                            <PiggyBank size={24} className="mr-2 text-pink-500" /> Monthly Expenses by Category
                        </h3>
                        {expenseCategoriesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={expenseCategoriesData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {expenseCategoriesData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `€${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-center text-gray-500 py-4">No expenses for this month to categorize.</p>
                        )}
                    </div>

                    {/* Quick overview of recent transactions (e.g., last 5 income/expenses) */}
                    <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                          <History size={24} className="mr-2 text-gray-600" /> Recent Transactions
                        </h3>
                        <div className="max-h-60 overflow-y-auto">
                            {/* Sort all transactions by date and take the most recent few */}
                            {[...income, ...expenses]
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .slice(0, 5) // Show top 5 recent transactions
                                .map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm mb-2 last:mb-0 border border-gray-100">
                                    <div>
                                        <p className="font-medium text-gray-900">{item.description}</p>
                                        <p className="text-sm text-gray-500">
                                            {item.date} • {item.category ? item.category : ''}
                                        </p>
                                    </div>
                                    <p className={`${item.category ? 'text-red-600' : 'text-green-600'} font-semibold`}>
                                        {item.category ? '-' : '+'}€{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            ))}
                            {income.length === 0 && expenses.length === 0 && (
                              <p className="text-center text-gray-500 py-4">No recent transactions.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


// Main App Component
function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [assets, setAssets] = useState([]);
  const [income, setIncome] = useState([]); // New state for income
  const [expenses, setExpenses] = useState([]); // New state for expenses
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard'); // Default to 'dashboard'

  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedAssetForUpdate, setSelectedAssetForUpdate] = useState(null);
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [selectedAssetForContribution, setSelectedAssetForContribution] = useState(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState(null);

  // New state for displaying individual asset history
  const [showAssetDetailsModal, setShowAssetDetailsModal] = useState(false);
  const [selectedAssetForDetails, setSelectedAssetForDetails] = useState(null);

  // New states for income/expense edit, delete, and history modals
  const [showEditIncomeModal, setShowEditIncomeModal] = useState(false);
  const [selectedIncomeForEdit, setSelectedIncomeForEdit] = useState(null);
  const [showIncomeDeleteConfirmModal, setShowIncomeDeleteConfirmModal] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState(null);
  const [showIncomeDetailsModal, setShowIncomeDetailsModal] = useState(false);
  const [selectedIncomeForDetails, setSelectedIncomeForDetails] = useState(null);


  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [selectedExpenseForEdit, setSelectedExpenseForEdit] = useState(null);
  const [showExpenseDeleteConfirmModal, setShowExpenseDeleteConfirmModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [showExpenseDetailsModal, setShowExpenseDetailsModal] = useState(false);
  const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState(null);


  // Fixed exchange rates (for demonstration purposes - real apps would use an API)
  const EXCHANGE_RATES = {
    EUR_TO_USD: 1.08, // 1 EUR = 1.08 USD (example rate)
    EUR_TO_GBP: 0.85, // 1 EUR = 0.85 GBP (example rate)
    EUR_TO_HUF: 395.00 // 1 EUR = 395.00 HUF (example rate)
  };


  // Firebase Initialization and Authentication
  useEffect(() => {
    try {
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          setIsAuthReady(true);
          console.log("User signed in:", user.uid);
        } else {
          try {
            // Sign in anonymously if no user is authenticated
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
              await signInWithCustomToken(firebaseAuth, __initial_auth_token);
              console.log("Signed in with custom token.");
            } else {
              const anonymousUser = await signInAnonymously(firebaseAuth);
              setUserId(anonymousUser.user.uid);
              setIsAuthReady(true);
              console.log("Signed in anonymously:", anonymousUser.user.uid);
            }
          } catch (authError) {
            console.error("Firebase Auth Error:", authError);
            setError("Failed to authenticate. Please try again.");
            setIsAuthReady(true); // Still set ready to avoid infinite loading
          }
        }
      });

      return () => unsubscribe(); // Cleanup auth listener
    } catch (err) {
      console.error("Firebase Init Error:", err);
      setError("Failed to initialize Firebase.");
      setLoading(false);
    }
  }, []);

  // Fetch assets from Firestore when auth and db are ready
  useEffect(() => {
    if (db && userId && isAuthReady) {
      setLoading(true);
      setError(null);
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

      // Fetch Assets
      const assetsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/assets`);
      const unsubscribeAssets = onSnapshot(query(assetsCollectionRef), (snapshot) => {
        const assetsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAssets(assetsData);
        setLoading(false);
      }, (err) => {
        console.error("Firestore Fetch Error (Assets):", err);
        setError("Failed to load assets. Please try again.");
        setLoading(false);
      });

      // Fetch Income
      const incomeCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/income`);
      const unsubscribeIncome = onSnapshot(query(incomeCollectionRef), (snapshot) => {
        const incomeData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setIncome(incomeData);
      }, (err) => {
        console.error("Firestore Fetch Error (Income):", err);
        setError("Failed to load income data.");
      });

      // Fetch Expenses
      const expensesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/expenses`);
      const unsubscribeExpenses = onSnapshot(query(expensesCollectionRef), (snapshot) => {
        const expensesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setExpenses(expensesData);
      }, (err) => {
        console.error("Firestore Fetch Error (Expenses):", err);
        setError("Failed to load expenses data.");
      });

      return () => {
        unsubscribeAssets();
        unsubscribeIncome();
        unsubscribeExpenses();
      }; // Cleanup all snapshot listeners
    }
  }, [db, userId, isAuthReady]);

  // Calculate total net worth
  const totalNetWorthEUR = assets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
  const totalNetWorthUSD = totalNetWorthEUR * EXCHANGE_RATES.EUR_TO_USD;
  const totalNetWorthGBP = totalNetWorthEUR * EXCHANGE_RATES.EUR_TO_GBP;
  const totalNetWorthHUF = totalNetWorthEUR * EXCHANGE_RATES.EUR_TO_HUF;


  // --- Asset Management Functions ---

  const addAsset = async (name, type, initialValue, initialDate) => { // Added initialDate
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/assets`), {
        name,
        type,
        initialValue: parseFloat(initialValue),
        currentValue: parseFloat(initialValue),
        contributions: [],
        valueHistory: [{ value: parseFloat(initialValue), date: initialDate }] // Use initialDate
      });
      setShowAddAssetModal(false);
      setLoading(false);
    } catch (e) {
      console.error("Error adding document: ", e);
      setError("Failed to add asset.");
      setLoading(false);
    }
  };

  const updateAssetValue = async (assetId, newValue) => {
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const assetRef = doc(db, `artifacts/${appId}/users/${userId}/assets`, assetId);
      const assetToUpdate = assets.find(a => a.id === assetId);

      // Ensure valueHistory exists and is an array
      const updatedValueHistory = Array.isArray(assetToUpdate.valueHistory)
        ? [...assetToUpdate.valueHistory, { value: parseFloat(newValue), date: new Date().toISOString().split('T')[0] }]
        : [{ value: parseFloat(newValue), date: new Date().toISOString().split('T')[0] }];

      await updateDoc(assetRef, {
        currentValue: parseFloat(newValue),
        valueHistory: updatedValueHistory
      });
      setShowUpdateModal(false);
      setSelectedAssetForUpdate(null);
      setLoading(false);
    } catch (e) {
      console.error("Error updating asset value: ", e);
      setError("Failed to update asset value.");
      setLoading(false);
    }
  };

  const addContribution = async (assetId, amount, contributionDate) => { // Added contributionDate
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const assetRef = doc(db, `artifacts/${appId}/users/${userId}/assets`, assetId);
      const assetToUpdate = assets.find(a => a.id === assetId);

      const newContribution = { amount: parseFloat(amount), date: contributionDate }; // Use contributionDate

      // Ensure contributions array exists and is an array
      const updatedContributions = Array.isArray(assetToUpdate.contributions)
        ? [...assetToUpdate.contributions, newContribution]
        : [newContribution];

      // Update current value by adding the contribution
      const newCurrentValue = (assetToUpdate.currentValue || 0) + parseFloat(amount);

      // Add to value history for charting
      const updatedValueHistory = Array.isArray(assetToUpdate.valueHistory)
        ? [...assetToUpdate.valueHistory, { value: newCurrentValue, date: contributionDate, type: 'contribution' }] // Use contributionDate
        : [{ value: newCurrentValue, date: contributionDate, type: 'contribution' }];

      await updateDoc(assetRef, {
        contributions: updatedContributions,
        currentValue: newCurrentValue,
        valueHistory: updatedValueHistory
      });
      setShowContributionModal(false);
      setSelectedAssetForContribution(null);
      setLoading(false);
    } catch (e) {
      console.error("Error adding contribution: ", e);
      setError("Failed to add contribution.");
      setLoading(false);
    }
  };

  const deleteAsset = async (assetId) => {
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/assets`, assetId));
      setShowDeleteConfirmModal(false);
      setAssetToDelete(null);
      setLoading(false);
    } catch (e) {
      console.error("Error deleting asset: ", e);
      setError("Failed to delete asset.");
      setLoading(false);
    }
  };

  // --- Income Management Functions ---
  const addIncome = async (amount, description, date, isRecurring = false, frequency = '', endDate = '') => {
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const newIncome = {
        amount: parseFloat(amount),
        description,
        date,
        isRecurring,
        frequency: isRecurring ? frequency : '',
        endDate: isRecurring && endDate ? endDate : '',
      };
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/income`), {
        ...newIncome,
        history: [{ ...newIncome, timestamp: new Date().toISOString(), changeType: "Initial Entry" }]
      });
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Error adding income: ", e);
      setError("Failed to add income.");
      setLoading(false);
      return false;
    }
  };

  const updateIncome = async (incomeId, newAmount, newDescription, newDate, newIsRecurring, newFrequency, newEndDate) => {
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const incomeRef = doc(db, `artifacts/${appId}/users/${userId}/income`, incomeId);
      const incomeToUpdate = income.find(item => item.id === incomeId);

      const updatedIncome = {
        amount: parseFloat(newAmount),
        description: newDescription,
        date: newDate,
        isRecurring: newIsRecurring,
        frequency: newIsRecurring ? newFrequency : '',
        endDate: newIsRecurring && newEndDate ? newEndDate : '',
      };

      const updatedHistory = Array.isArray(incomeToUpdate.history)
        ? [...incomeToUpdate.history, { ...updatedIncome, timestamp: new Date().toISOString(), changeType: "Update" }]
        : [{ ...updatedIncome, timestamp: new Date().toISOString(), changeType: "Initial Entry" }];

      await updateDoc(incomeRef, { ...updatedIncome, history: updatedHistory });
      setShowEditIncomeModal(false);
      setSelectedIncomeForEdit(null);
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Error updating income: ", e);
      setError("Failed to update income.");
      setLoading(false);
      return false;
    }
  };

  const deleteIncome = async (incomeId) => {
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/income`, incomeId));
      setShowIncomeDeleteConfirmModal(false);
      setIncomeToDelete(null);
      setLoading(false);
    } catch (e) {
      console.error("Error deleting income: ", e);
      setError("Failed to delete income.");
      setLoading(false);
    }
  };

  // --- Expense Management Functions ---
  const addExpense = async (amount, description, category, date, isRecurring = false, frequency = '', endDate = '') => { // Added 'date' param
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const newExpense = {
        amount: parseFloat(amount),
        description,
        category,
        type: isRecurring ? 'Recurring' : 'One-Off', // Derive type from isRecurring
        date,
        isRecurring,
        frequency: isRecurring ? frequency : '',
        endDate: isRecurring && endDate ? endDate : '',
      };
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/expenses`), {
        ...newExpense,
        history: [{ ...newExpense, timestamp: new Date().toISOString(), changeType: "Initial Entry" }]
      });
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Error adding expense: ", e);
      setError("Failed to add expense.");
      setLoading(false);
      return false;
    }
  };

  const updateExpense = async (expenseId, newAmount, newDescription, newCategory, newDate, newIsRecurring, newFrequency, newEndDate) => { // Added 'newDate' param
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const expenseRef = doc(db, `artifacts/${appId}/users/${userId}/expenses`, expenseId);
      const expenseToUpdate = expenses.find(item => item.id === expenseId);

      const updatedExpense = {
        amount: parseFloat(newAmount),
        description: newDescription,
        category: newCategory,
        type: newIsRecurring ? 'Recurring' : 'One-Off', // Derive type from newIsRecurring
        date: newDate,
        isRecurring: newIsRecurring,
        frequency: newIsRecurring ? newFrequency : '',
        endDate: newIsRecurring && newEndDate ? newEndDate : '',
      };

      const updatedHistory = Array.isArray(expenseToUpdate.history)
        ? [...expenseToUpdate.history, { ...updatedExpense, timestamp: new Date().toISOString(), changeType: "Update" }]
        : [{ ...updatedExpense, timestamp: new Date().toISOString(), changeType: "Initial Entry" }];

      await updateDoc(expenseRef, { ...updatedExpense, history: updatedHistory });
      setShowEditExpenseModal(false);
      setSelectedExpenseForEdit(null);
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Error updating expense: ", e);
      setError("Failed to update expense.");
      setLoading(false);
      return false;
    }
  };

  const deleteExpense = async (expenseId) => {
    if (!db || !userId) {
      console.error("Firestore or User ID not available.");
      setError("App not ready. Please wait.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/expenses`, expenseId));
      setShowExpenseDeleteConfirmModal(false);
      setExpenseToDelete(null);
      setLoading(false);
    } catch (e) {
      console.error("Error deleting expense: ", e);
      setError("Failed to delete expense.");
      setLoading(false);
    }
  };


  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 p-4 text-center">
        <div className="p-8 bg-white rounded-xl shadow-lg animate-pulse">
          <p className="text-xl font-semibold text-gray-700">Loading application...</p>
          <p className="text-gray-500 mt-2">Initializing Firebase and authenticating user.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-inter text-gray-800 flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white shadow-xl p-6 flex flex-col min-h-screen rounded-r-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-indigo-700 flex items-center justify-center">
            <BarChart2 size={30} className="mr-2" /> Net Worth
          </h1>
        </div>
        <nav className="flex-1 space-y-3">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" page="dashboard" currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <NavItem icon={<TrendingUp size={20} />} label="Assets" page="assets" currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <NavItem icon={<History size={20} />} label="Net Worth History" page="history" currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <NavItem icon={<LineChartIcon size={20} />} label="Projections" page="projections" currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <NavItem icon={<ReceiptText size={20} />} label="Income/Expenses" page="incomeExpenses" currentPage={currentPage} setCurrentPage={setCurrentPage} />
          <NavItem icon={<CalendarCheck size={20} />} label="Monthly Overview" page="monthlyOverview" currentPage={currentPage} setCurrentPage={setCurrentPage} />
        </nav>
        {userId && (
          <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded-lg break-all mt-6">
            User ID: <span className="font-mono text-indigo-600">{userId}</span>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-auto">
        <header className="bg-white p-6 rounded-xl shadow-lg mb-6 flex items-center justify-between">
          <h1 className="text-4xl font-extrabold text-indigo-700">
            {/* Dynamic Page Title based on currentPage */}
            {currentPage === 'dashboard' && 'Dashboard'}
            {currentPage === 'assets' && 'Your Assets'}
            {currentPage === 'history' && 'Net Worth History'}
            {currentPage === 'projections' && 'Net Worth Projections'}
            {currentPage === 'incomeExpenses' && 'Income & Expenses'}
            {currentPage === 'monthlyOverview' && 'Monthly Overview'}
          </h1>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {loading && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-4 flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading data...
          </div>
        )}

        {/* Page Content based on currentPage */}
        {currentPage === 'dashboard' && (
          <DashboardPage
            assets={assets}
            income={income}
            expenses={expenses}
            loading={loading}
            totalNetWorthEUR={totalNetWorthEUR}
          />
        )}

        {currentPage === 'assets' && (
          <AssetsPage
            assets={assets}
            loading={loading}
            totalNetWorthEUR={totalNetWorthEUR}
            totalNetWorthUSD={totalNetWorthUSD}
            totalNetWorthGBP={totalNetWorthGBP}
            totalNetWorthHUF={totalNetWorthHUF}
            setShowAddAssetModal={setShowAddAssetModal}
            setShowUpdateModal={setShowUpdateModal}
            setSelectedAssetForUpdate={setSelectedAssetForUpdate}
            setShowContributionModal={setShowContributionModal}
            setSelectedAssetForContribution={setSelectedAssetForContribution}
            setShowDeleteConfirmModal={setShowDeleteConfirmModal}
            setAssetToDelete={setAssetToDelete}
            setShowAssetDetailsModal={setShowAssetDetailsModal}
            setSelectedAssetForDetails={setSelectedAssetForDetails}
            addAsset={addAsset}
            updateAssetValue={updateAssetValue}
            addContribution={addContribution}
            deleteAsset={deleteAsset}
          />
        )}

        {currentPage === 'history' && (
          <NetWorthHistoryChart assets={assets} loading={loading} />
        )}

        {currentPage === 'projections' && (
          <NetWorthProjectionChart currentNetWorth={totalNetWorthEUR} loading={loading} />
        )}

        {currentPage === 'incomeExpenses' && (
          <IncomeExpensesPage
            income={income}
            expenses={expenses}
            addIncome={addIncome}
            addExpense={addExpense}
            updateIncome={updateIncome}
            updateExpense={updateExpense}
            deleteIncome={deleteIncome}
            deleteExpense={deleteExpense}
            loading={loading}
            setShowEditIncomeModal={setShowEditIncomeModal}
            setSelectedIncomeForEdit={setSelectedIncomeForEdit}
            setShowIncomeDetailsModal={setShowIncomeDetailsModal}
            setSelectedIncomeForDetails={setSelectedIncomeForDetails}
            setShowIncomeDeleteConfirmModal={setShowIncomeDeleteConfirmModal}
            setIncomeToDelete={setIncomeToDelete}
            setShowEditExpenseModal={setShowEditExpenseModal}
            setSelectedExpenseForEdit={setSelectedExpenseForEdit}
            setShowExpenseDetailsModal={setShowExpenseDetailsModal}
            setSelectedExpenseForDetails={setSelectedExpenseForDetails}
            setShowExpenseDeleteConfirmModal={setShowExpenseDeleteConfirmModal}
            setExpenseToDelete={setExpenseToDelete}
          />
        )}

        {currentPage === 'monthlyOverview' && (
          <MonthlyOverviewPage
            income={income}
            expenses={expenses}
            loading={loading}
          />
        )}
      </main>

      {/* Modals (can remain at the App level as they are global overlays) */}
      {showAddAssetModal && (
        <Modal title="Add New Asset" onClose={() => setShowAddAssetModal(false)}>
          <AddAssetForm onAdd={addAsset} onClose={() => setShowAddAssetModal(false)} />
        </Modal>
      )}

      {showUpdateModal && selectedAssetForUpdate && (
        <Modal title={`Update Value for ${selectedAssetForUpdate.name}`} onClose={() => setShowUpdateModal(false)}>
          <UpdateAssetValueForm
            asset={selectedAssetForUpdate}
            onUpdate={updateAssetValue}
            onClose={() => setShowUpdateModal(false)}
          />
        </Modal>
      )}

      {showContributionModal && selectedAssetForContribution && (
        <Modal title={`Add Contribution to ${selectedAssetForContribution.name}`} onClose={() => setShowContributionModal(false)}>
          <AddContributionForm
            asset={selectedAssetForContribution}
            onAddContribution={addContribution}
            onClose={() => setShowContributionModal(false)}
          />
        </Modal>
      )}

      {showDeleteConfirmModal && assetToDelete && (
        <Modal title="Confirm Deletion" onClose={() => setShowDeleteConfirmModal(false)}>
          <p className="mb-4 text-center text-gray-700">
            Are you sure you want to delete the asset: <span className="font-semibold text-indigo-600">{assetToDelete.name}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => {
                deleteAsset(assetToDelete.id);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md shadow-lg transition duration-200 transform hover:scale-105"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirmModal(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-md shadow-lg transition duration-200 transform hover:scale-105"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* New Modal for individual asset history details */}
      {showAssetDetailsModal && selectedAssetForDetails && (
        <Modal title={`History for ${selectedAssetForDetails.name}`} onClose={() => setShowAssetDetailsModal(false)}>
          <AssetHistoryDetailsModal asset={selectedAssetForDetails} />
        </Modal>
      )}

      {/* Income Edit Modal */}
      {showEditIncomeModal && selectedIncomeForEdit && (
        <Modal title={`Edit Income: ${selectedIncomeForEdit.description}`} onClose={() => setShowEditIncomeModal(false)}>
          <EditIncomeForm
            incomeItem={selectedIncomeForEdit}
            onUpdate={updateIncome}
            onClose={() => setShowEditIncomeModal(false)}
          />
        </Modal>
      )}

      {/* Income Delete Confirmation Modal */}
      {showIncomeDeleteConfirmModal && incomeToDelete && (
        <Modal title="Confirm Income Deletion" onClose={() => setShowIncomeDeleteConfirmModal(false)}>
          <p className="mb-4 text-center text-gray-700">
            Are you sure you want to delete the income: <span className="font-semibold text-teal-600">{incomeToDelete.description}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => {
                deleteIncome(incomeToDelete.id);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md shadow-lg transition duration-200 transform hover:scale-105"
            >
              Delete
            </button>
            <button
              onClick={() => setShowIncomeDeleteConfirmModal(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-md shadow-lg transition duration-200 transform hover:scale-105"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Income History Details Modal */}
      {showIncomeDetailsModal && selectedIncomeForDetails && (
        <Modal title="Income Details & History" onClose={() => setShowIncomeDetailsModal(false)}>
          <TransactionHistoryDetailsModal transaction={selectedIncomeForDetails} />
        </Modal>
      )}


      {/* Expense Edit Modal */}
      {showEditExpenseModal && selectedExpenseForEdit && (
        <Modal title={`Edit Expense: ${selectedExpenseForEdit.description}`} onClose={() => setShowEditExpenseModal(false)}>
          <EditExpenseForm
            expenseItem={selectedExpenseForEdit}
            onUpdate={updateExpense}
            onClose={() => setShowEditExpenseModal(false)}
          />
        </Modal>
      )}

      {/* Expense Delete Confirmation Modal */}
      {showExpenseDeleteConfirmModal && expenseToDelete && (
        <Modal title="Confirm Expense Deletion" onClose={() => setShowExpenseDeleteConfirmModal(false)}>
          <p className="mb-4 text-center text-gray-700">
            Are you sure you want to delete the expense: <span className="font-semibold text-red-600">{expenseToDelete.description}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => {
                deleteExpense(expenseToDelete.id);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md shadow-lg transition duration-200 transform hover:scale-105"
            >
              Delete
            </button>
            <button
              onClick={() => setShowExpenseDeleteConfirmModal(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-md shadow-lg transition duration-200 transform hover:scale-105"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Expense History Details Modal */}
      {showExpenseDetailsModal && selectedExpenseForDetails && (
        <Modal title="Expense Details & History" onClose={() => setShowExpenseDetailsModal(false)}>
          <TransactionHistoryDetailsModal transaction={selectedExpenseForDetails} />
        </Modal>
      )}

    </div>
  );
}

// NavItem Component for Sidebar
const NavItem = ({ icon, label, page, currentPage, setCurrentPage }) => (
  <button
    onClick={() => setCurrentPage(page)}
    className={`w-full flex items-center px-4 py-3 rounded-lg text-left font-medium transition duration-200 ${
      currentPage === page
        ? 'bg-indigo-100 text-indigo-700 shadow-md'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    }`}
  >
    <span className="mr-3">{icon}</span>
    {label}
  </button>
);


// Add Asset Form Component
function AddAssetForm({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Cash'); // Default type
  const [initialValue, setInitialValue] = useState('');
  const [initialDate, setInitialDate] = useState(new Date().toISOString().split('T')[0]); // New state for initial date
  const [formError, setFormError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!name || !type || initialValue === '' || !initialDate) { // Validate date
      setFormError('All fields are required.');
      return;
    }
    const value = parseFloat(initialValue);
    if (isNaN(value) || value < 0) {
      setFormError('Initial Value must be a non-negative number.');
      return;
    }
    onAdd(name, type, value, initialDate); // Pass initialDate
    // onClose(); // Handled by App component after successful add
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
          {formError}
        </div>
      )}
      <div>
        <label htmlFor="assetName" className="block text-sm font-medium text-gray-700 mb-1">Asset Name</label>
        <input
          type="text"
          id="assetName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="e.g., Savings Account, My House"
          required
        />
      </div>
      <div>
        <label htmlFor="assetType" className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
        <select
          id="assetType"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
        >
          <option value="Cash">Cash</option>
          <option value="Investment">Investment</option>
          <option value="Real Estate">Real Estate</option>
          <option value="Vehicle">Vehicle</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="initialValue" className="block text-sm font-medium text-gray-700 mb-1">Initial Value</label>
        <input
          type="number"
          id="initialValue"
          value={initialValue}
          onChange={(e) => setInitialValue(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="0.00"
          min="0"
          step="0.01"
          required
        />
      </div>
      <div> {/* New Date input for Initial Value */}
        <label htmlFor="initialDate" className="block text-sm font-medium text-gray-700 mb-1">Date of Initial Value</label>
        <input
          type="date"
          id="initialDate"
          value={initialDate}
          onChange={(e) => setInitialDate(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
        />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Add Asset
        </button>
      </div>
    </form>
  );
}

// Update Asset Value Form Component
function UpdateAssetValueForm({ asset, onUpdate, onClose }) {
  const [newValue, setNewValue] = useState(asset.currentValue || '');
  const [formError, setFormError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const value = parseFloat(newValue);
    if (isNaN(value) || value < 0) {
      setFormError('New Value must be a non-negative number.');
      return;
    }
    onUpdate(asset.id, value);
    // onClose(); // Handled by App component after successful update
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
          {formError}
        </div>
      )}
      <div>
        <label htmlFor="newValue" className="block text-sm font-medium text-gray-700 mb-1">New Value for {asset.name}</label>
        <input
          type="number"
          id="newValue"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="0.00"
          min="0"
          step="0.01"
          required
        />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel

        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Update Value
        </button>
      </div>
    </form>
  );
}

// Add Contribution Form Component
function AddContributionForm({ asset, onAddContribution, onClose }) {
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionDate, setContributionDate] = useState(new Date().toISOString().split('T')[0]); // New state for contribution date
  const [formError, setFormError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!contributionAmount || !contributionDate) { // Validate date
      setFormError('All fields are required.');
      return;
    }
    const amount = parseFloat(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Contribution amount must be a positive number.');
      return;
    }
    onAddContribution(asset.id, amount, contributionDate); // Pass contributionDate
    // onClose(); // Handled by App component after successful add
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
          {formError}
        </div>
      )}
      <div>
        <label htmlFor="contributionAmount" className="block text-sm font-medium text-gray-700 mb-1">Contribution to {asset.name}</label>
        <input
          type="number"
          id="contributionAmount"
          value={contributionAmount}
          onChange={(e) => setContributionAmount(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="0.00"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <div> {/* New Date input for Contribution */}
        <label htmlFor="contributionDate" className="block text-sm font-medium text-gray-700 mb-1">Date of Contribution</label>
        <input
          type="date"
          id="contributionDate"
          value={contributionDate}
          onChange={(e) => setContributionDate(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
        />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Add Contribution
        </button>
      </div>
    </form>
  );
}

// Add Income Form Component
function AddIncomeForm({ onAdd, onClose }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('Monthly'); // Default to monthly for recurring
  const [endDate, setEndDate] = useState(''); // Optional end date
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!amount || !description || !date) {
      setFormError('All fields are required.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }
    if (isRecurring && endDate && new Date(endDate) < new Date(date)) {
        setFormError('End Date cannot be before the Start Date.');
        return;
    }

    const success = await onAdd(parsedAmount, description, date, isRecurring, frequency, endDate);
    if (success) {
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
          {formError}
        </div>
      )}
      <div>
        <label htmlFor="incomeAmount" className="block text-sm font-medium text-gray-700 mb-1">Amount (EUR)</label>
        <input
          type="number"
          id="incomeAmount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
          placeholder="0.00"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <div>
        <label htmlFor="incomeDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          id="incomeDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
          placeholder="e.g., Monthly Salary, Freelance Work"
          required
        />
      </div>
      <div>
        <label htmlFor="incomeDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input
          type="date"
          id="incomeDate"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
          required
        />
      </div>
      <div className="flex items-center mt-4">
        <input
          id="isRecurringIncome"
          name="isRecurringIncome"
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
        />
        <label htmlFor="isRecurringIncome" className="ml-2 block text-sm text-gray-900">
          Recurring Income
        </label>
      </div>

      {isRecurring && (
        <>
          <div>
            <label htmlFor="incomeFrequency" className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              id="incomeFrequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
              required
            >
              <option value="Monthly">Monthly</option>
              {/* Add other frequencies as needed */}
            </select>
          </div>
          <div>
            <label htmlFor="incomeEndDate" className="block text-sm font-medium text-gray-700 mb-1">Optional End Date</label>
            <input
              type="date"
              id="incomeEndDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          Add Income
        </button>
      </div>
    </form>
  );
}

// Edit Income Form Component
function EditIncomeForm({ incomeItem, onUpdate, onClose }) {
  const [amount, setAmount] = useState(incomeItem.amount);
  const [description, setDescription] = useState(incomeItem.description);
  const [date, setDate] = useState(incomeItem.date);
  const [isRecurring, setIsRecurring] = useState(incomeItem.isRecurring || false);
  const [frequency, setFrequency] = useState(incomeItem.frequency || 'Monthly');
  const [endDate, setEndDate] = useState(incomeItem.endDate || '');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!amount || !description || !date) {
      setFormError('All fields are required.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }
    if (isRecurring && endDate && new Date(endDate) < new Date(date)) {
        setFormError('End Date cannot be before the Start Date.');
        return;
    }

    const success = await onUpdate(incomeItem.id, parsedAmount, description, date, isRecurring, frequency, endDate);
    if (success) {
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
          {formError}
        </div>
      )}
      <div>
        <label htmlFor="incomeAmount" className="block text-sm font-medium text-gray-700 mb-1">Amount (EUR)</label>
        <input
          type="number"
          id="incomeAmount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
          placeholder="0.00"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <div>
        <label htmlFor="incomeDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          id="incomeDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
          placeholder="e.g., Monthly Salary, Freelance Work"
          required
        />
      </div>
      <div>
        <label htmlFor="incomeDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input
          type="date"
          id="incomeDate"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
          required
        />
      </div>
      <div className="flex items-center mt-4">
        <input
          id="isRecurringIncome"
          name="isRecurringIncome"
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
        />
        <label htmlFor="isRecurringIncome" className="ml-2 block text-sm text-gray-900">
          Recurring Income
        </label>
      </div>

      {isRecurring && (
        <>
          <div>
            <label htmlFor="incomeFrequency" className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              id="incomeFrequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
              required
            >
              <option value="Monthly">Monthly</option>
              {/* Add other frequencies as needed */}
            </select>
          </div>
          <div>
            <label htmlFor="incomeEndDate" className="block text-sm font-medium text-gray-700 mb-1">Optional End Date</label>
            <input
              type="date"
              id="incomeEndDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          Update Income
        </button>
      </div>
    </form>
  );
}

// Add Expense Form Component
function AddExpenseForm({ onAdd, onClose }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal'); // Default
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('Monthly'); // Default to monthly for recurring
  const [endDate, setEndDate] = useState(''); // Optional end date
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!amount || !description || !category || !date) { // Added 'date' to validation
      setFormError('All fields are required.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }
    if (isRecurring && endDate && new Date(endDate) < new Date(date)) {
        setFormError('End Date cannot be before the Start Date.');
        return;
    }

    // Pass isRecurring directly, App component will derive 'type'
    const success = await onAdd(parsedAmount, description, category, date, isRecurring, frequency, endDate); // Added 'date' param
    if (success) {
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
          {formError}
        </div>
      )}
      <div>
        <label htmlFor="expenseAmount" className="block text-sm font-medium text-gray-700 mb-1">Amount (EUR)</label>
        <input
          type="number"
          id="expenseAmount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
          placeholder="0.00"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <div>
        <label htmlFor="expenseDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          id="expenseDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
          placeholder="e.g., Groceries, Rent, Coffee"
          required
        />
      </div>
      <div>
        <label htmlFor="expenseCategory" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          id="expenseCategory"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
          required
        >
          <option value="Personal">Personal</option>
          <option value="Shared">Shared</option>
        </select>
      </div>
      {/* Removed the 'type' dropdown as per user request */}
      <div>
        <label htmlFor="expenseDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input
          type="date"
          id="expenseDate"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
          required
        />
      </div>
      <div className="flex items-center mt-4">
        <input
          id="isRecurringExpense"
          name="isRecurringExpense"
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
        />
        <label htmlFor="isRecurringExpense" className="ml-2 block text-sm text-gray-900">
          Recurring Expense
        </label>
      </div>

      {isRecurring && (
        <>
          <div>
            <label htmlFor="expenseFrequency" className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              id="expenseFrequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              required
            >
              <option value="Monthly">Monthly</option>
              {/* Add other frequencies as needed */}
            </select>
          </div>
          <div>
            <label htmlFor="expenseEndDate" className="block text-sm font-medium text-gray-700 mb-1">Optional End Date</label>
            <input
              type="date"
              id="expenseEndDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Add Expense
        </button>
      </div>
    </form>
  );
}

// Edit Expense Form Component
function EditExpenseForm({ expenseItem, onUpdate, onClose }) {
  const [amount, setAmount] = useState(expenseItem.amount);
  const [description, setDescription] = useState(expenseItem.description);
  const [category, setCategory] = useState(expenseItem.category || 'Personal');
  const [date, setDate] = useState(expenseItem.date);
  const [isRecurring, setIsRecurring] = useState(expenseItem.isRecurring || false);
  const [frequency, setFrequency] = useState(expenseItem.frequency || 'Monthly');
  const [endDate, setEndDate] = useState(expenseItem.endDate || '');
  const [formError, setFormError] = useState('');

  // When expenseItem changes (e.g., when a new item is selected for editing),
  // update the form states.
  useEffect(() => {
    setAmount(expenseItem.amount);
    setDescription(expenseItem.description);
    setCategory(expenseItem.category || 'Personal');
    setDate(expenseItem.date);
    setIsRecurring(expenseItem.isRecurring || false);
    setFrequency(expenseItem.frequency || 'Monthly');
    setEndDate(expenseItem.endDate || '');
    setFormError('');
  }, [expenseItem]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!amount || !description || !category || !date) { // Added 'date' to validation
      setFormError('All fields are required.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }
    if (isRecurring && endDate && new Date(endDate) < new Date(date)) {
        setFormError('End Date cannot be before the Start Date.');
        return;
    }

    // Pass newIsRecurring directly, App component will derive 'type'
    const success = await onUpdate(expenseItem.id, parsedAmount, description, category, date, isRecurring, frequency, endDate); // Added 'date' param
    if (success) {
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
          {formError}
        </div>
      )}
      <div>
        <label htmlFor="expenseAmount" className="block text-sm font-medium text-gray-700 mb-1">Amount (EUR)</label>
        <input
          type="number"
          id="expenseAmount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
          placeholder="0.00"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <div>
        <label htmlFor="expenseDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          id="expenseDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
          placeholder="e.g., Groceries, Rent, Coffee"
          required
        />
      </div>
      <div>
        <label htmlFor="expenseCategory" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          id="expenseCategory"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
          required
        >
          <option value="Personal">Personal</option>
          <option value="Shared">Shared</option>
        </select>
      </div>
      {/* Removed the 'type' dropdown as per user request */}
      <div>
        <label htmlFor="expenseDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input
          type="date"
          id="expenseDate"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
          required
        />
      </div>
      <div className="flex items-center mt-4">
        <input
          id="isRecurringExpense"
          name="isRecurringExpense"
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
        />
        <label htmlFor="isRecurringExpense" className="ml-2 block text-sm text-gray-900">
          Recurring Expense
        </label>
      </div>

      {isRecurring && (
        <>
          <div>
            <label htmlFor="expenseFrequency" className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              id="expenseFrequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              required
            >
              <option value="Monthly">Monthly</option>
              {/* Add other frequencies as needed */}
            </select>
          </div>
          <div>
            <label htmlFor="expenseEndDate" className="block text-sm font-medium text-gray-700 mb-1">Optional End Date</label>
            <input
              type="date"
              id="expenseEndDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Update Expense
        </button>
      </div>
    </form>
  );
}
export default App;
