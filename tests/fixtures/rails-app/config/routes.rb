Rails.application.routes.draw do
  root "home#index"

  get "/health", to: "health#show"

  resources :photos

  namespace :admin do
    resources :articles
  end

  scope "/api" do
    resources :sessions, only: [:create, :destroy]
  end

  resources :users, only: [:index, :show]
end
