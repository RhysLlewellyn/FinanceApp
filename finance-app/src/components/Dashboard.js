import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  CircularProgress,
  useTheme,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Switch,
  Chip,
  LinearProgress,
  IconButton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import AddIcon from '@mui/icons-material/Add';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import api from '../services/api';
import { formatCurrency } from '../utils/currencyFormatter';
import { usePlaidLinkContext } from '../services/PlaidLinkProvider';
import { useAuth } from '../services/authContext';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlaidLink from './PlaidLink';

function Dashboard() {
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [spendingTrends, setSpendingTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const { open, ready, error } = usePlaidLinkContext();
  const { isAuthenticated, user } = useAuth();
  const [weeklyActivity, setWeeklyActivity] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [financialHealthScore, setFinancialHealthScore] = useState(null);
  const [financialGoals, setFinancialGoals] = useState([]);
  const theme = useTheme();
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const navigate = useNavigate();
  const [isPlaidLoading, setIsPlaidLoading] = useState(false);
  const [showPlaidLink, setShowPlaidLink] = useState(false);

  useEffect(() => {
    console.log('Dashboard mounted');
    console.log('Auth state:', {
      isAuthenticated,
      user,
      token: localStorage.getItem('token'),
    });
  }, [isAuthenticated, user]);

  const fetchDashboardData = useCallback(async () => {
    console.log('fetchDashboardData called, isAuthenticated:', isAuthenticated);
    if (isAuthenticated) {
      try {
        setLoading(true);
        console.log('Starting dashboard data fetch...');

        const promises = [
          api.get('/recent_transactions').catch((e) => {
            console.error('Recent transactions failed:', e);
            return { data: [] };
          }),
          api.get('/budget_summary').catch((e) => {
            console.error('Budget summary failed:', e);
            return { data: {} };
          }),
          api.get('/accounts').catch((e) => {
            console.error('Accounts failed:', e);
            return { data: [] };
          }),
          api.get('/spending_trends', { params: { months: 24 } }).catch((e) => {
            console.error('Spending trends failed:', e);
            return { data: {} };
          }),
          api.get('/weekly_activity').catch((e) => {
            console.error('Weekly activity failed:', e);
            return { data: [] };
          }),
          api.get('/balance_history').catch((e) => {
            console.error('Balance history failed:', e);
            return { data: [] };
          }),
          api.get('/financial_health_score').catch((e) => {
            console.error('Financial health score failed:', e);
            return { data: { score: 0 } };
          }),
          api.get('/financial_goals').catch((e) => {
            console.error('Financial goals failed:', e);
            return { data: [] };
          }),
        ];

        const [
          transactionsResponse,
          budgetResponse,
          accountsResponse,
          spendingTrendsResponse,
          weeklyActivityResponse,
          balanceHistoryResponse,
          financialHealthResponse,
          financialGoalsResponse,
        ] = await Promise.all(promises);

        console.log('All dashboard data fetched successfully');

        setBudgetSummary(budgetResponse.data);
        setRecentTransactions(transactionsResponse.data);
        setAccounts(accountsResponse.data.slice(0, 5));
        setWeeklyActivity(weeklyActivityResponse.data);
        setBalanceHistory(balanceHistoryResponse.data);

        // Convert spending trends data to array and sort
        const trendsData = Object.entries(spendingTrendsResponse.data)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5); // Take top 5 categories
        setSpendingTrends(trendsData);

        setFinancialHealthScore(financialHealthResponse.data.score);
        setFinancialGoals(financialGoalsResponse.data);
      } catch (error) {
        console.error('Error in fetchDashboardData:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response,
          status: error?.response?.status,
        });
      } finally {
        setLoading(false);
      }
    } else {
      console.log('Not authenticated, skipping fetch. Auth state:', {
        isAuthenticated,
        user,
        token: localStorage.getItem('token'),
      });
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [fetchDashboardData, isAuthenticated]);

  const handleOpenPlaidLink = useCallback(() => {
    setShowPlaidLink(true);
  }, []);

  const COLORS = ['#4318FF', '#FF69B4', '#8884d8', '#FF8042'];

  const CustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const getHealthScoreColor = (score) => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FF9800'; // Orange
    return '#FF3B3B'; // Red
  };

  const getHealthScoreMessage = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Attention';
  };

  const handleCreateBudget = () => {
    navigate('/budgets/new');
  };

  const handleViewSpendingTrends = () => {
    navigate('/spending-trends');
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const renderBalanceCard = () => (
    <Card
      sx={{
        bgcolor: '#4318FF',
        color: 'white',
        borderRadius: 4,
        mb: 2,
      }}
    >
      <CardContent>
        <Typography variant="h6">Total Balance</Typography>
        <Typography variant="h4">
          {formatCurrency(
            accounts.reduce((total, account) => total + account.balance, 0),
            accounts[0]?.iso_currency_code || 'GBP'
          )}
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">LINKED ACCOUNTS</Typography>
          <Typography variant="body1">
            {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  const renderQuickActions = () => (
    <Card sx={{ height: '100%', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
          Quick Actions
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            startIcon={<AssessmentIcon />}
            onClick={handleViewSpendingTrends}
            sx={{
              bgcolor: '#4318FF',
              color: 'white',
              borderRadius: 2,
              py: 1.5,
              '&:hover': { bgcolor: alpha('#4318FF', 0.9) },
            }}
          >
            Spending Trends
          </Button>

          <Button
            startIcon={<TrendingUpIcon />}
            onClick={handleCreateBudget}
            sx={{
              bgcolor: 'white',
              color: '#4318FF',
              border: '1px solid',
              borderColor: alpha('#4318FF', 0.3),
              borderRadius: 2,
              py: 1.5,
              '&:hover': {
                bgcolor: alpha('#4318FF', 0.05),
                borderColor: '#4318FF',
              },
            }}
          >
            Create Budget
          </Button>

          <Button
            startIcon={<AccountBalanceIcon />}
            onClick={handleOpenPlaidLink}
            disabled={!ready || isPlaidLoading}
            sx={{
              bgcolor: 'white',
              color: '#4318FF',
              border: '1px solid',
              borderColor: alpha('#4318FF', 0.3),
              borderRadius: 2,
              py: 1.5,
              '&:hover': {
                bgcolor: alpha('#4318FF', 0.05),
                borderColor: '#4318FF',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(0, 0, 0, 0.04)',
                borderColor: 'rgba(0, 0, 0, 0.12)',
                color: 'rgba(0, 0, 0, 0.26)',
              },
            }}
          >
            {isPlaidLoading ? <CircularProgress size={24} /> : 'Link Account'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box
      sx={{
        flexGrow: 1,
        p: 3,
        bgcolor: '#FAFAFA',
        height: '100%',
        overflow: 'auto',
        maxHeight: 'calc(100vh - 64px)',
      }}
    >
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Overview
      </Typography>
      <Grid container spacing={3}>
        {/* Financial Health Score */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Financial Health Score
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  py: 4,
                }}
              >
                <CircularProgress
                  variant="determinate"
                  value={financialHealthScore}
                  size={160}
                  thickness={4}
                  sx={{
                    color: (theme) => getHealthScoreColor(financialHealthScore),
                    '& .MuiCircularProgress-circle': {
                      strokeLinecap: 'round',
                    },
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}
                >
                  <Typography
                    variant="h4"
                    sx={{
                      color: getHealthScoreColor(financialHealthScore),
                      fontWeight: 'bold',
                    }}
                  >
                    {financialHealthScore}%
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      mt: 0.5,
                    }}
                  >
                    {getHealthScoreMessage(financialHealthScore)}
                  </Typography>
                </Box>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  mt: 2,
                  textAlign: 'center',
                  color: 'text.secondary',
                }}
              >
                {financialHealthScore < 60
                  ? "Your score suggests there's room for improvement. Try reducing expenses and building savings."
                  : 'Keep up the good work! Your financial health is on track.'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          {renderQuickActions()}
        </Grid>

        {/* Financial Goals */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Financial Goals
                </Typography>
                <Button
                  component={Link}
                  to="/goals"
                  color="primary"
                  sx={{ textTransform: 'none' }}
                >
                  Manage Goals
                </Button>
              </Box>
              {financialGoals.length === 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    py: 4,
                    px: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    gutterBottom
                  >
                    Start planning your financial future by setting your first
                    goal
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    component={Link}
                    to="/goals/new"
                    sx={{ mt: 2 }}
                  >
                    Create Your First Goal
                  </Button>
                </Box>
              ) : (
                financialGoals.map((goal, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 3,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      '&:hover': {
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 1,
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 'medium' }}
                      >
                        {goal.name || goal.goal_name}
                      </Typography>
                      <Chip
                        label={`${Math.round(
                          (goal.current_amount / goal.target_amount) * 100
                        )}%`}
                        color={
                          goal.current_amount >= goal.target_amount
                            ? 'success'
                            : 'primary'
                        }
                        size="small"
                      />
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(goal.current_amount / goal.target_amount) * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'rgba(67, 24, 255, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor:
                            goal.current_amount >= goal.target_amount
                              ? 'success.main'
                              : 'primary.main',
                          borderRadius: 4,
                        },
                      }}
                    />
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mt: 1,
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(
                          goal.current_amount,
                          accounts[0]?.iso_currency_code
                        )}{' '}
                        of{' '}
                        {formatCurrency(
                          goal.target_amount,
                          accounts[0]?.iso_currency_code
                        )}
                      </Typography>
                      {goal.current_amount >= goal.target_amount && (
                        <Chip
                          label="Goal Reached! 🎉"
                          color="success"
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Balance Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Total Balance
                </Typography>
                <Button
                  component={Link}
                  to="/accounts"
                  color="primary"
                  sx={{ textTransform: 'none' }}
                >
                  Manage Accounts
                </Button>
              </Box>

              <Box
                sx={{
                  bgcolor: '#4318FF',
                  color: 'white',
                  borderRadius: 3,
                  p: 3,
                  mb: 2,
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(
                    accounts.reduce(
                      (total, account) => total + account.balance,
                      0
                    ),
                    accounts[0]?.iso_currency_code || 'GBP'
                  )}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    LINKED ACCOUNTS
                  </Typography>
                  <Typography variant="body1">
                    {accounts.length}{' '}
                    {accounts.length === 1 ? 'Account' : 'Accounts'}
                  </Typography>
                </Box>
              </Box>

              {/* List of accounts */}
              <List>
                {accounts.slice(0, 3).map((account) => (
                  <ListItem
                    key={account.id}
                    sx={{
                      py: 1,
                      borderRadius: 2,
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        bgcolor: alpha('#4318FF', 0.1),
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        mr: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography sx={{ color: '#4318FF', fontWeight: 'bold' }}>
                        {account.name.charAt(0)}
                      </Typography>
                    </Box>
                    <ListItemText
                      primary={account.name}
                      secondary={account.type}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {formatCurrency(
                        account.balance,
                        account.iso_currency_code
                      )}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Recent Transactions
                </Typography>
                <Button
                  component={Link}
                  to="/transactions"
                  color="primary"
                  sx={{ textTransform: 'none' }}
                >
                  See All
                </Button>
              </Box>
              <List>
                {recentTransactions.slice(0, 5).map((transaction, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      py: 1,
                      borderRadius: 2,
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        bgcolor:
                          transaction.amount > 0
                            ? alpha('#4CAF50', 0.1)
                            : alpha('#FF3B3B', 0.1),
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        mr: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        sx={{
                          color: transaction.amount > 0 ? '#4CAF50' : '#FF3B3B',
                        }}
                      >
                        {transaction.amount > 0 ? '+' : '-'}
                      </Typography>
                    </Box>
                    <ListItemText
                      primary={transaction.description}
                      secondary={transaction.date}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: transaction.amount > 0 ? '#4CAF50' : '#FF3B3B',
                        fontWeight: 'medium',
                      }}
                    >
                      {formatCurrency(
                        Math.abs(transaction.amount),
                        transaction.iso_currency_code
                      )}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Weekly Activity */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Weekly Activity
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyActivity} barSize={20}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) =>
                      formatCurrency(value, accounts[0]?.iso_currency_code)
                    }
                    labelFormatter={(label) => label}
                  />
                  <Bar
                    dataKey="deposit"
                    fill="#4318FF"
                    radius={[10, 10, 0, 0]}
                  />
                  <Bar
                    dataKey="withdraw"
                    fill="#FF69B4"
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Expense Statistics */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Expense Statistics
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Array.isArray(spendingTrends) ? spendingTrends : []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {Array.isArray(spendingTrends) &&
                      spendingTrends.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => [
                      formatCurrency(value, accounts[0]?.iso_currency_code),
                      props.payload.category,
                    ]}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #f0f0f0',
                      borderRadius: '4px',
                      padding: '8px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    layout="horizontal"
                    formatter={(value, entry) => {
                      const item = spendingTrends[entry.payload.index];
                      return item ? item.category : '';
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Balance History - now full width */}
        <Grid item xs={12}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Balance History
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={balanceHistory}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleString('default', {
                        month: 'short',
                      })
                    }
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={
                      (value) =>
                        formatCurrency(
                          value,
                          accounts[0]?.iso_currency_code
                        ).split('.')[0] // Remove decimals for cleaner Y-axis
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      formatCurrency(value, accounts[0]?.iso_currency_code)
                    }
                    labelFormatter={(label) =>
                      new Date(label).toLocaleDateString()
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#4318FF"
                    fill="url(#colorBalance)"
                    strokeWidth={2}
                  />
                  <defs>
                    <linearGradient
                      id="colorBalance"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#4318FF" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4318FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <IconButton onClick={handleRefresh}>
        <RefreshIcon />
      </IconButton>
      {showPlaidLink && (
        <PlaidLink
          onSuccess={(public_token, metadata) => {
            console.log('Plaid Link success:', metadata);
            setShowPlaidLink(false);
            fetchDashboardData(); // Refresh data after linking
          }}
          onExit={(err, metadata) => {
            console.log('Plaid Link exit:', err, metadata);
            setShowPlaidLink(false);
          }}
          onError={(error) => {
            console.error('Plaid Link error:', error);
            setShowPlaidLink(false);
          }}
        />
      )}
    </Box>
  );
}

export default Dashboard;
